<template>
  <div class="c-app flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol md="6">
          <CCard class="p-4">
            <CCardBody class="text-center">
              <img src="@/assets/logo.svg" height="130px"/>
              <h3 class="mt-3">Sign in</h3>
              <p class="text-muted mb-4">Sign in with MFU Google account</p>
              <img
                v-if="!loading"
                class="google-btn"
                @click="onAuthenGoogle"
                src="@/assets/icons/logo-google.png"
                width="52px"
                alt="Google Sign-In"
              />
              <div v-if="loading" class="mt-3">
                <span class="text-muted">Signing in...</span>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
    <TwoFA/>
    <CenterLoading/>
    <DialogMessage/>
  </div>
</template>

<script>
import TwoFA from '@/projects/components/dialog/TwoFA.vue'
import CenterLoading from '@/projects/components/dialog/CenterLoading.vue'
import DialogMessage from '@/projects/components/dialog/DialogMessage.vue'

const GSI_CLIENT_ID = window._GOOGLE_CLIENT_ID || '225788483142-8pkg8on8nh60ao83ve33ff3lflv2ccvo.apps.googleusercontent.com'
const AUTH_TYPE_ID = '689c06d5255db4e56aea8902'

function loadGsiScript() {
  return new Promise(function(resolve, reject) {
    if (window.google && window.google.accounts) {
      resolve()
      return
    }
    const existing = document.getElementById('gsi-script')
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function getGoogleIdToken() {
  return new Promise(function(resolve, reject) {
    loadGsiScript().then(function() {
      window.google.accounts.id.initialize({
        client_id: GSI_CLIENT_ID,
        callback: function(response) {
          if (response && response.credential) {
            resolve(response.credential)
          } else {
            reject(new Error('no_credential'))
          }
        },
        ux_mode: 'popup',
        cancel_on_tap_outside: true
      })
      window.google.accounts.id.prompt(function(notification) {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One-tap was blocked — fall back to explicit popup
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GSI_CLIENT_ID,
            scope: 'profile email openid',
            prompt: 'select_account',
            callback: function() {}
          })
          // Use id_token flow via renderButton approach with a temp div
          const tempDiv = document.createElement('div')
          tempDiv.style.display = 'none'
          document.body.appendChild(tempDiv)
          window.google.accounts.id.renderButton(tempDiv, {
            type: 'standard',
            shape: 'rectangular',
            theme: 'outline',
            text: 'signin_with',
            size: 'large'
          })
          // Click the hidden button to trigger popup
          const btn = tempDiv.querySelector('div[role=button]')
          if (btn) {
            btn.click()
          } else {
            document.body.removeChild(tempDiv)
            reject(new Error('popup_blocked'))
          }
          // Cleanup after 5 minutes
          setTimeout(function() {
            if (document.body.contains(tempDiv)) {
              document.body.removeChild(tempDiv)
            }
          }, 300000)
          return
        }
      })
    }).catch(reject)
  })
}

export default {
  name: 'Login',
  components: {
    TwoFA,
    CenterLoading,
    DialogMessage
  },
  data() {
    return {
      loading: false
    }
  },
  methods: {
    async onAuthenGoogle() {
      this.loading = true
      try {
        const id_token = await getGoogleIdToken()
        const body = {
          token: id_token,
          authType: AUTH_TYPE_ID
        }
        await this.$store.dispatch('auth/signIn', body)
      } catch (err) {
        this.$store.commit('dialog/showError', {
          title: 'Authentication Error',
          message: 'Google Sign-In failed or was cancelled. Please try again.',
          code: 'AUTH_GOOGLE_FAILED',
          number: '1',
          status: true
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.google-btn {
  cursor: pointer;
  transition: transform 0.15s ease;
}
.google-btn:hover {
  transform: scale(1.08);
}
</style>
