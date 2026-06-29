module.exports = {
  lintOnSave: false,
  runtimeCompiler: true,
  productionSourceMap: false,
  css: {
    extract: {
      ignoreOrder: true
    },
    loaderOptions: {
      scss: {
        sassOptions: {
          quietDeps: true,
          silenceDeprecations: [
            'legacy-js-api',
            'import',
            'global-builtin',
            'slash-div',
            'color-functions',
            'if-function'
          ]
        }
      },
      sass: {
        sassOptions: {
          quietDeps: true,
          silenceDeprecations: [
            'legacy-js-api',
            'import',
            'global-builtin',
            'slash-div',
            'color-functions',
            'if-function'
          ]
        }
      }
    }
  },
  devServer: {
    disableHostCheck: true,
    proxy: {
      '^/ai-engine': {
        target: 'http://127.0.0.1:8000',
        pathRewrite: { '^/ai-engine': '' },
        changeOrigin: true
      },
      '^/ai-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  configureWebpack: {
    //Necessary to run npm link https://webpack.js.org/configuration/resolve/#resolve-symlinks
    resolve: {
       symlinks: false
    },
    performance: {
      hints: false
    }
  },
  transpileDependencies: [
    '@coreui/utils',
    'axios'
  ],
  // use this option for production linking
  // publicPath: process.env.NODE_ENV === 'production' ? '/vue/demo/3.0.0' : '/'
};
