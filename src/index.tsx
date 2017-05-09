import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as lean from 'lean-client-js-browser';
import translations from '../translations.json';
const GitBook = require('gitbook-core');

declare const ace: any;
let Range: any;

const server = new lean.Server(new lean.BrowserInProcessTransport({
    javascript: 'https://leanprover.github.io/lean.js/lean3.js',
}));
server.error.on((err) => console.log('lean error', err));
server.tasks.on((tasks) => console.log('tasks', tasks));

let lazyInit: Promise<any> = null;
function init() {
    return lazyInit || (lazyInit = new Promise((resolve) => {
        server.connect();

        const $script = require('scriptjs');
        $script('https://leanprover.github.io/ace/ace/ace.js', () =>
        $script('https://leanprover.github.io/ace/ace/ext-language_tools.js', () => {
            ace.require('ace/lib/lang');
            ace.require('ace/autocomplete/util');
            ace.require('ace/ext/language_tools');
            ace.require('ace/mode/lean');
            ace.require('ace/theme/subatomic');
            Range = ace.require('ace/range').Range;
            const dom = ace.require('ace/lib/dom');
            dom.importCssString('.ace_editor.ace_autocomplete { width: 40em !important; max-width: 50%; }');
            dom.importCssString('.ace_gutter { background: white !important; }');
            resolve();
        }));
    }));
}

interface AceProps {
    children: React.ReactNode;
}

function getChildrenToText(children: React.ReactNode): string {
    return React.Children.map(children, (child, i) => {
        if (typeof child === 'string') {
            return child;
        } else {
            let child_ = child as React.ReactElement<any>;
            return child_.props.children ?
                getChildrenToText(child_.props.children) : '';
        }
    }).join('');
}

let fileNameIdx = 1;

class AceEditor extends React.Component<AceProps, undefined> {
    syncTimer: any;
    editor: any;
    fileName: string;
    private subscriptions: lean.EventListenerHandle[];

    componentDidMount() {
        this.subscriptions = [];
        const node = ReactDOM.findDOMNode<HTMLElement>(this.refs.root);
        this.fileName = `${fileNameIdx++}.lean`;
        init().then(() => {
            this.editor = ace.edit(node);
            this.editor.setTheme('ace/theme/clouds');
            this.editor.getSession().setMode('ace/mode/lean');
            this.editor.setShowPrintMargin(false);
            this.editor.setOptions({minLines: this.editor.getValue().split('\n').length+1});
            this.editor.setOptions({maxLines: 50});
            this.editor.setOptions({fontSize: '14pt'});
            this.editor.setHighlightActiveLine(false);
            this.editor.setHighlightGutterLine(false);
            this.editor.renderer.setOption('showLineNumbers', false);
            this.editor.on('change', () => this.delayedSync());
            this.subscriptions.push(server.allMessages.on((msgs) => this.showMessages(msgs)));
            this.setupCompleter();
            this.setupInputMethod();
        });
    }

    componentWillUnmount() {
        for (const s of this.subscriptions) {
            s.dispose();
        }
        this.subscriptions = [];
        this.syncTimer && clearTimeout(this.syncTimer);
    }

    showMessages(messages: lean.AllMessagesResponse) {
        const annotations: any[] = [];
        for (const msg of messages.msgs) {
            if (msg.file_name == this.fileName) {
                annotations.push({
                    row: msg.pos_line - 1, column: msg.pos_col,
                    type: msg.severity === 'information' ? 'info' : msg.severity,
                    text: msg.text,
                });
            }
        }
        this.editor.session.setAnnotations(annotations);
    }

    private setupCompleter() {
        this.editor.completers = [{
            getCompletions: (editor, session, pos, prefix, callback) => {
                this.sync();
                server.complete(this.fileName, pos.row + 1, pos.column).then(res =>
                    callback(null, res.completions &&
                        res.completions.map((compl) => ({value: compl.text, meta: compl.type}))));
            },
            identifierRegexp: /[A-Za-z_'.]/,
        }];
        this.editor.setOptions({
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: false,
            enableSnippets: true,
        });
    }

    private setupInputMethod() {
        this.editor.commands.on("afterExec", e => {
            if (e.command.name === "insertstring") {
                if (e.args === " " || e.args === "\\") {
                    const pos = this.editor.getCursorPosition();
                    const line = this.editor.session.getLine(pos.row);
                    const place_to_search = e.args === " " ? pos.column -1 : pos.column - 2;
                    const index = line.lastIndexOf("\\", place_to_search) + 1
                    const match = line.substring(index, pos.column - 1);
                    let replaceText = translations[match];
                    if (index && replaceText) {
                        if (e.args === "\\") {
                            replaceText = replaceText + e.args;
                        }
                        this.editor.session.replace(
                            new Range(pos.row, index - 1, pos.row, pos.column),
                            replaceText,
                        );
                    }
                }
            }
        });
    }

    delayedSync() {
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.sync(), 100);
    }

    sync() {
        clearTimeout(this.syncTimer);
        server.sync(this.fileName, this.editor.getValue());
    }

    render() {
        const style = {
            // border: '1px solid lightgray',
        };
        return (
            <div ref='root' style={style}>
                {getChildrenToText(this.props.children)}
            </div>
        );
    }
}

module.exports = GitBook.createPlugin({
    activate: (dispatch, getState, {Components}) => {
        dispatch(Components.registerComponent(AceEditor, { role: 'html:pre' }));
    },
    deactivate: (dispatch, getState) => {
        // Dispatch cleanup actions
    },
    reduce: (state, action) => state
});
