module.exports = {
  devServer: {
    disableHostCheck: true,
    port: 8004,
    clientLogLevel: "silent",
    before: function(app, server, compiler) {
      console.log('configbefore')
    }
  },
  lintOnSave: false,
  configureWebpack: {
    module: {
      // entry: './src/index.ts',
      rules: [
        {
          test: /\.worker\.js$/,
          use: { loader: 'worker-loader' }
        },
        {
          test: /\.worker\.ts$/,
          use: { loader: 'ts-loader' }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.css', '.json'],
      alias: {
        'vue$': 'vue/dist/vue.esm.js'
      }
    },
    module: {
      rules: [
        // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
        { test: /\.ts?$/, loader: "ts-loader" }
      ]
    }
    }
}