import store from "@/store/store";
import Service from "@/service/api";
import { getOrCreateDeviceId } from "@/service/device-id";
import { hasSessionHint, setSessionHint } from "@/service/session-hint";
import { setItem, getItem, removeItem } from '@/utils/db';
import router from "../../../router/index.js";
import { getPayload } from '../shared/api'
import { resolveFirstAccessiblePath } from '@/projects/utils/permission-landing'

const X_ACCESS_TOKEN_STORAGE_KEY = 'x-access-token';
const POST_SIGNIN_ROUTE = '/dashboard';
const APP_AUTH_SYSTEM = process.env.VUE_APP_AUTH_SYSTEM || process.env.VUE_APP_PROJECT_APP_ID || 'aibasedautomaticnetworkconfigurationsystem';

async function resolvePostSignInRoute(fallback = POST_SIGNIN_ROUTE) {
    const getters = store && store.getters ? store.getters : {};
    try {
        if (!getters['security/loaded'] && store && typeof store.dispatch === 'function') {
            await store.dispatch('security/fetchMyPermissions');
        }
    } catch (err) {
        // Permission loading failure is handled by the router guard.
    }
    return getters['security/landingPath'] ||
        resolveFirstAccessiblePath(getters['security/canAccess'], fallback);
}

async function pushPostSignInRoute(fallback = POST_SIGNIN_ROUTE) {
    if (!router || typeof router.push !== 'function') return;
    const landingPath = await resolvePostSignInRoute(fallback);
    const pushed = router.push(landingPath);
    if (pushed && typeof pushed.catch === 'function') {
        pushed.catch(() => {});
    }
}

function withAuthSystem(payload) {
    return Object.assign({}, payload || {}, {
        system: APP_AUTH_SYSTEM,
        authSystem: APP_AUTH_SYSTEM
    });
}

function getTokenFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return '';
    }
    const raw = window.localStorage.getItem(X_ACCESS_TOKEN_STORAGE_KEY);
    return raw && String(raw).trim() ? String(raw).trim() : '';
}

function setTokenToLocalStorage(token) {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    if (token && String(token).trim()) {
        window.localStorage.setItem(X_ACCESS_TOKEN_STORAGE_KEY, String(token).trim());
    } else {
        window.localStorage.removeItem(X_ACCESS_TOKEN_STORAGE_KEY);
    }
}

function resolveBackendMessage(message) {
    if (!message) {
        return '';
    }
    if (typeof message === 'string') {
        return message.trim();
    }
    if (Array.isArray(message)) {
        const preferred = message.find(function (item) {
            return item && item.key === 'en' && item.value;
        }) || message.find(function (item) {
            return item && item.key === 'th' && item.value;
        }) || message.find(function (item) {
            return item && item.value;
        });
        return preferred && preferred.value ? String(preferred.value).trim() : '';
    }
    if (message && typeof message.value === 'string') {
        return String(message.value).trim();
    }
    return '';
}

const ServerModule = {
    namespaced: true,
    state: {
        authenticated: {
            isAuthen: false,
            isOAuth: false,
        },
        pendingToken: '',
        isSignIn: true,
        is2FA: false,
        profile: null,
        message:[],
    },

    modules: {

    },

    mutations: {
        authenticated(state, obj) {
            state.authenticated = Object.assign({}, state.authenticated, obj || {});
        },

        message(state, obj) {
            state.message = obj;
        },
        profile(state, obj) {
            state.profile = obj || null;
        },
        isSignIn(state, value) {
            state.isSignIn = !!value;
        },
        is2FA(state, value) {
            state.is2FA = !!value;
        },
        pendingToken(state, value) {
            state.pendingToken = value ? String(value) : '';
        }

    },

    actions: {
        async bootstrapSession({ commit, state }) {
            const stateToken = store.state.XAccessToken ? String(store.state.XAccessToken).trim() : '';
            const alreadyAuthenticated = !!(state && state.authenticated && state.authenticated.isAuthen);
            const hasProfile = !!(state && state.profile && state.profile.email);
            if (stateToken && alreadyAuthenticated && hasProfile) {
                return;
            }

            let tokenFromDb = '';
            let tokenFromLocal = '';
            try {
                const stored = await getItem('objs');
                tokenFromDb = stored && stored.xAccessToken ? String(stored.xAccessToken).trim() : '';
            } catch (err) {
                tokenFromDb = '';
            }
            tokenFromLocal = getTokenFromLocalStorage();

            const token = stateToken || tokenFromDb || tokenFromLocal;
            if (token && token !== stateToken) {
                store.commit('set', ['XAccessToken', token]);
            }

            const shouldTrySessionRestore = !!token || hasSessionHint();
            const isDuringTwoFactor = !!(state && (state.is2FA || state.pendingToken));
            if (!isDuringTwoFactor && shouldTrySessionRestore) {
                try {
                    const meRes = await Service.authenticated('me-silent', {}, {});
                    const me = getPayload(meRes);
                    const sessionToken = me && me.sessionToken ? String(me.sessionToken).trim() : '';
                    const resolvedToken = sessionToken || token;
                    if (resolvedToken) {
                        store.commit('set', ['XAccessToken', resolvedToken]);
                        setTokenToLocalStorage(resolvedToken);
                        await setItem('objs', { xAccessToken: resolvedToken });
                    }
                    setSessionHint(true);
                    commit('profile', me);
                    commit('authenticated', { isAuthen: true, isOAuth: true });
                    commit('isSignIn', false);
                    commit('is2FA', false);
                    commit('pendingToken', '');
                    return;
                } catch (err) {
                    try {
                        await removeItem('objs');
                    } catch (removeErr) {
                        // IndexedDB cleanup is best-effort; session state is reset below.
                    }
                    store.commit('set', ['XAccessToken', '']);
                    setTokenToLocalStorage('');
                    setSessionHint(false);
                }
            }

            commit('authenticated', { isAuthen: false, isOAuth: false });
            commit('profile', null);
            commit('isSignIn', true);
            commit('is2FA', false);
        },
        message(_, data) {

            Service.authenticated('message', data, {})
                .then((response) => {
                    store.commit("auth/message", getPayload(response))
                }).catch(() => {

            });
        },

        createMessage(_, data) {

            Service.authenticated('create-message', data, {})
                .then((response) => {
                    store.commit("auth/message", getPayload(response));
                    store.dispatch("auth/message",{});
                }).catch(() => {
            });
        },


        updateMessage(_, data) {
            Service.authenticated('update-message', data, {})
                .then((response) => {
                    store.commit("auth/message", getPayload(response));
                    store.dispatch("auth/message",{});
                }).catch(() => {
            });
        },

        removeMessage(_, data) {
            Service.authenticated('remove-message', data)
                .then((response) => {
                    store.commit("auth/message", getPayload(response));
                    store.dispatch("auth/message",{});
                }).catch(() => {
            });


        },


        async signIn({commit, dispatch}, data) {
            store.commit("dialog/loading", true);
            try {
                const payload = withAuthSystem(data || {});
                payload.deviceId = getOrCreateDeviceId();

                const response = await Service.authenticated('signin', payload, {});
                const objs = getPayload(response);
                const token = objs && objs.xAccessToken ? String(objs.xAccessToken) : '';
                if (!token) {
                    throw new Error('missing_token');
                }
                setTokenToLocalStorage(token);
                const require2FA = !(objs && objs.require2FA === false);

                store.commit('security/reset');
                store.commit('set', ['XAccessToken', token]);
                commit('pendingToken', token);
                commit('authenticated', { isAuthen: false, isOAuth: false });
                commit('profile', null);
                commit('isSignIn', false);
                commit('is2FA', require2FA);

                if (!require2FA) {
                    await setItem('objs', { xAccessToken: token });
                    setSessionHint(true);
                    const meRes = await Service.authenticated('me', {}, {});
                    const me = getPayload(meRes);
                    const sessionToken = me && me.sessionToken ? String(me.sessionToken).trim() : '';
                    const resolvedToken = sessionToken || token;
                    if (resolvedToken) {
                        store.commit('security/reset');
                        store.commit('set', ['XAccessToken', resolvedToken]);
                        setTokenToLocalStorage(resolvedToken);
                        await setItem('objs', { xAccessToken: resolvedToken });
                    }
                    commit('profile', me);
                    commit('authenticated', { isAuthen: true, isOAuth: true });
                    commit('isSignIn', false);
                    commit('is2FA', false);
                    commit('pendingToken', '');
                    await pushPostSignInRoute();
                    return;
                }

                try {
                    await dispatch('twofa', {});
                } catch (err) {
                    try {
                        await removeItem('objs');
                    } catch (removeErr) {
                        // IndexedDB cleanup is best-effort; session state is reset below.
                    }
                    store.commit('set', ['XAccessToken', '']);
                    store.commit('security/reset');
                    setTokenToLocalStorage('');
                    setSessionHint(false);
                    commit('pendingToken', '');
                    commit('authenticated', { isAuthen: false, isOAuth: false });
                    commit('profile', null);
                    commit('isSignIn', true);
                    commit('is2FA', false);
                    store.commit('dialog/showError', {
                        title: "Authentication Error",
                        message: "Unable to send verification code. Please try again.",
                        code: "AUTH_2FA_REQUEST_FAILED",
                        number: "1",
                        status: true
                    })
                    return;
                }
            } catch (err) {
                store.commit("dialog/loading",false)
                const backendCode = err && err.response && err.response.data && err.response.data.code
                  ? String(err.response.data.code)
                  : "AUTH_SIGNIN_FAILED";
                const backendMessage = err && err.response && err.response.data && err.response.data.message
                  ? resolveBackendMessage(err.response.data.message)
                  : "";
                store.commit('dialog/showError', {
                    title: "Authentication Error",
                    message: backendMessage || "Sign in failed. Please try again.",
                    code: backendCode,
                    number: "1",
                    status: true
                })
            } finally {
                store.commit("dialog/loading",false)
            }
        },

        async twofa({ commit }, data) {
            commit('is2FA', true);
            await Service.authenticated('twofa-request', withAuthSystem(data || {}), {});
            return true;
        },

        async twofaSend({ commit, state }, data) {
            await Service.authenticated('twofa-verify', withAuthSystem(data || {}), {});
            if (!state.pendingToken) {
                throw new Error('missing_pending_token');
            }
            await setItem('objs', { xAccessToken: state.pendingToken });
            setTokenToLocalStorage(state.pendingToken);
            setSessionHint(true);
            const meRes = await Service.authenticated('me', {}, {});
            const me = getPayload(meRes);
            const sessionToken = me && me.sessionToken ? String(me.sessionToken).trim() : '';
            const resolvedToken = sessionToken || state.pendingToken;
            if (resolvedToken) {
                store.commit('security/reset');
                store.commit('set', ['XAccessToken', resolvedToken]);
                setTokenToLocalStorage(resolvedToken);
                await setItem('objs', { xAccessToken: resolvedToken });
            }

            commit('profile', me);
            commit('authenticated', { isAuthen: true, isOAuth: true });
            commit('isSignIn', false);
            commit('is2FA', false);
            commit('pendingToken', '');
            try {
                await Service.authenticated('trust-device', withAuthSystem({ deviceId: getOrCreateDeviceId() }), {});
            } catch (err) {
                // Trusted device persistence must not block a completed sign-in.
            }
            return true;
        },

        async trustDevice() {
            await Service.authenticated('trust-device', withAuthSystem({ deviceId: getOrCreateDeviceId() }), {});
            return true;
        },

        async completeSignInFlow({ dispatch }, payload) {
            var trustDevice = !!(payload && payload.trustDevice);
            if (trustDevice) {
                try {
                    await dispatch('trustDevice');
                } catch (err) {
                    // Do not block login completion if trust-device fails.
                }
            }
            await pushPostSignInRoute();
            return true;
        },

        async signOut({commit}) {
            try {
                await Service.authenticated('logout', withAuthSystem({}), {});
            } catch (err) {
                // Best-effort logout. Clear local session even if backend revoke fails.
            }
            try {
                await removeItem('objs');
            } catch (removeErr) {
                // IndexedDB cleanup is best-effort; session state is reset below.
            }
            setSessionHint(false);
            store.commit('set', ['XAccessToken', '']);
            setTokenToLocalStorage('');
            commit('authenticated', { isAuthen: false, isOAuth: false });
            commit('profile', null);
            commit('isSignIn', true);
            commit('is2FA', false);
            commit('pendingToken', '');
            store.commit('security/reset')
            if (router && typeof router.push === 'function') {
                router.push('/pages/login');
            }
        },

    },

    getters: {

        message(state) {
            return state.message;
        },

        authenticated(state) {
            return state.authenticated;
        },
        profile(state) {
            return state.profile;
        },
        isSignIn(state) {
            return state.isSignIn;
        },
        is2FA(state) {
            return state.is2FA;
        },
        pendingToken(state) {
            return state.pendingToken;
        }
    },
};

export default ServerModule;
