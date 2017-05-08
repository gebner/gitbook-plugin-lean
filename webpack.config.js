const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');

let distDir = path.resolve(__dirname, '_assets');

module.exports = {
    entry: 'lean-client-js-browser/lib/webworkerscript',
    output: {
        path: distDir,
        filename: 'worker.js',
        publicPath: '/',
    },
    resolve: { extensions: ['.ts', '.tsx', '.js'] },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: [
                    'babel-loader?presets[]=env',
                    'ts-loader'],
            },
        ],
    },
    // devServer: { contentBase: distDir },
    // plugins: [new HtmlWebpackPlugin],
    node: {
        child_process: 'empty',
        readline: 'empty',
    },
    externals: {
        react: 'require("react")',
        'react-dom': 'require("react-dom")',
        'gitbook-core': 'require("gitbook-core")',
    },
}