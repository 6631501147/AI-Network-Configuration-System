import Service from "@/service/api";
import menu from './menu'
import group from './group'
import permissionMatrix from './permission-matrix'
import audit from './audit'
import assignment from './assignment'
import { resolveFirstAccessiblePath } from '@/projects/utils/permission-landing'

function normalizePermissionPath(path) {
  if (!path) return '';
  let normalized = String(path).trim();
  const queryIndex = normalized.indexOf('?');
  if (queryIndex !== -1) normalized = normalized.slice(0, queryIndex);
  const hashIndex = normalized.indexOf('#');
  if (hashIndex !== -1) normalized = normalized.slice(0, hashIndex);
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function swapPermissionPlurality(path) {
  const normalized = normalizePermissionPath(path);
  if (!normalized) return '';
  if (normalized.includes('/permissions')) return normalized.replace('/permissions', '/permission');
  if (normalized.includes('/permission')) return normalized.replace('/permission', '/permissions');
  return '';
}

function normalizePermissionMatrix(matrix) {
  const source = matrix && typeof matrix === 'object' ? matrix : {};
  return Object.keys(source).reduce((acc, key) => {
    const normalizedKey = normalizePermissionPath(key);
    if (!normalizedKey) return acc;
    acc[normalizedKey] = Object.assign(
      { all: false, view: false, edit: false, delete: false, action: false, logs: false },
      acc[normalizedKey] || {},
      source[key] || {}
    );
    return acc;
  }, {});
}

let fetchMyPermissionsPromise = null;

const ServerModule = {
  namespaced: true,
  modules: {
    menu,
    group,
    permissionMatrix,
    audit,
    assignment
  },
  state: {
    matrix: {},
    assignments: [],
    permissions: [],
    loaded: false,
    loading: false
  },
  mutations: {
    setLoading(state, value) {
      state.loading = value;
    },
    setMyPermissions(state, payload) {
      state.matrix = normalizePermissionMatrix(payload && payload.matrix ? payload.matrix : {});
      state.assignments = payload && payload.assignments ? payload.assignments : [];
      state.permissions = payload && payload.permissions ? payload.permissions : [];
      state.loaded = true;
    },
    reset(state) {
      state.matrix = {};
      state.assignments = [];
      state.permissions = [];
      state.loaded = false;
      state.loading = false;
    }
  },
  actions: {
    async fetchMyPermissions({ commit, rootGetters }, params = {}) {
      if (fetchMyPermissionsPromise) return fetchMyPermissionsPromise;
      commit('setLoading', true);
      fetchMyPermissionsPromise = (async () => {
        const profile = rootGetters['auth/profile'] || null;
        const accountId = params && params.accountId
          ? params.accountId
          : (profile && (profile._id || profile.id) ? String(profile._id || profile.id) : '');
        const query = accountId
          ? Object.assign({}, params, { accountId })
          : Object.assign({}, params);
        const response = await Service.security('my-permissions', query);
        const data = response && response.data && response.data.data ? response.data.data : {};
        commit('setMyPermissions', data);
        return data;
      })();
      try {
        return await fetchMyPermissionsPromise;
      } finally {
        fetchMyPermissionsPromise = null;
        commit('setLoading', false);
      }
    }
  },
  getters: {
    matrix(state) {
      return state.matrix;
    },
    loaded(state) {
      return state.loaded;
    },
    canAccess: (state) => (path, action = 'view') => {
      if (!path) return true;
      const normalizedPath = normalizePermissionPath(path);
      const rule = state.matrix[normalizedPath] || state.matrix[swapPermissionPlurality(normalizedPath)];
      if (!rule) return false;
      return !!(rule.all || rule[action]);
    },
    landingPath: (state, getters) => {
      return resolveFirstAccessiblePath(getters.canAccess);
    }
  }
};

export default ServerModule;
