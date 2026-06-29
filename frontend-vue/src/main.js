import 'core-js/stable'
import Vue from 'vue'
import CoreuiVuePro from '@coreui/vue-pro'
// import CoreuiVuePro from '../node_modules/@coreui/vue-pro/src/index.js'
// import CoreuiVue from '@coreui/vue'
import App from './App'
import router from './router/index'
import { iconsSet as icons } from './assets/icons/icons.js'
import i18n from './i18n.js'
import store from "@/store/store";

// เพิ่มการ import CIcon และ CSS ของ CoreUI Icons
import { CIcon } from '@coreui/icons-vue'
Vue.component('CIcon', CIcon)
import '@coreui/icons/css/all.min.css'
import '@/projects/styles/global.scss'

import OtpInput from "@bachdgvn/vue-otp-input";
Vue.component("v-otp-input", OtpInput);

Vue.use(CoreuiVuePro)
Vue.prototype.$log = console.log.bind(console)
import moment from 'moment'
Vue.prototype.moment = moment

// Google Identity Services (GIS) - replaces deprecated vue-google-oauth2 / gapi.auth2
const GIS_CLIENT_ID = process.env.VUE_APP_CLIENTID || '225788483142-8pkg8on8nh60ao83ve33ff3lflv2ccvo.apps.googleusercontent.com';

const googleAuthPlugin = {
  install(Vue) {
    let _resolveSignIn = null;
    let _rejectSignIn = null;
    let _scriptLoaded = false;

    function loadGISScript() {
      return new Promise((resolve) => {
        if (_scriptLoaded || (window.google && window.google.accounts)) {
          _scriptLoaded = true;
          return resolve();
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => { _scriptLoaded = true; resolve(); };
        script.onerror = () => resolve(); // Fail gracefully
        document.head.appendChild(script);
      });
    }

    const gAuth = {
      signIn() {
        return new Promise(async (resolve, reject) => {
          try {
            await loadGISScript();
            if (!window.google || !window.google.accounts) {
              return reject(new Error('Google Identity Services failed to load'));
            }
            _resolveSignIn = resolve;
            _rejectSignIn = reject;

            const client = window.google.accounts.oauth2.initCodeClient({
              client_id: GIS_CLIENT_ID,
              scope: 'openid email profile',
              ux_mode: 'popup',
              callback: (response) => {
                if (response.error) {
                  if (_rejectSignIn) _rejectSignIn(new Error(response.error));
                  return;
                }
                // Exchange code for id_token via Google's token endpoint is not needed;
                // use initTokenClient instead to get access_token, then use userinfo
                if (_resolveSignIn) _resolveSignIn({ code: response.code });
              }
            });

            // Use token client to get id_token directly
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: GIS_CLIENT_ID,
              scope: 'openid email profile',
              callback: (tokenResponse) => {
                if (tokenResponse.error) {
                  if (_rejectSignIn) _rejectSignIn(new Error(tokenResponse.error));
                  return;
                }
                // Fetch user info using access_token
                fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: 'Bearer ' + tokenResponse.access_token }
                })
                  .then(r => r.json())
                  .then(userInfo => {
                    // Build a fake googleUser object compatible with the existing signIn flow
                    const fakeGoogleUser = {
                      getAuthResponse: () => ({ id_token: tokenResponse.access_token }),
                      _userInfo: userInfo,
                      _accessToken: tokenResponse.access_token
                    };
                    if (_resolveSignIn) _resolveSignIn(fakeGoogleUser);
                  })
                  .catch(err => { if (_rejectSignIn) _rejectSignIn(err); });
              },
              error_callback: (err) => {
                if (_rejectSignIn) _rejectSignIn(new Error(err && err.message ? err.message : 'popup_closed'));
              }
            });

            tokenClient.requestAccessToken({ prompt: 'select_account' });

          } catch (err) {
            reject(err);
          }
        });
      }
    };

    Vue.prototype.$gAuth = gAuth;
  }
};
Vue.use(googleAuthPlugin);

new Vue({
  el: '#app',
  router,
  store,
  //CIcon component documentation: https://coreui.io/vue/docs/components/icon
  icons,
  i18n,
  template: '<App/>',
  components: {
    App
  }
})
