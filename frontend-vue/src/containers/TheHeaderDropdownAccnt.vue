<template>
  <div class="account-header-shell">
    <CDropdown
      inNav
      class="c-header-nav-items"
      placement="bottom-end"
      add-menu-classes="pt-0 mt-2"
    >
      <template #toggler>
        <CHeaderNavLink class="account-header-toggle">
          <div class="account-header-toggle__identity">
            <span class="account-header-toggle__name">{{ displayName }}</span>
          </div>
          <div class="account-header-toggle__avatar c-avatar">
            <img :src="avatarSrc" class="c-avatar-img" :alt="copy.avatarAlt" @error="onProfileImageError">
          </div>
        </CHeaderNavLink>
      </template>

      <CDropdownItem @click="onCheckProfile">
        <CIcon name="cil-user" size="xl" /> {{ copy.checkProfile }}
      </CDropdownItem>
      <CDropdownDivider/>
      <CDropdownItem @click="onLogout">
        <CIcon name="cil-lock-locked" size="xl" /> {{ copy.logout }}
      </CDropdownItem>
    </CDropdown>

    <CModal
      :show="showProfileDialog"
      @update:show="onProfileDialogShowChange"
      class="account-profile-modal"
      add-content-classes="border-radius-1"
    >
      <template #header-wrapper><div></div></template>

      <div class="account-profile-dialog">
        <aside class="account-profile-card">
          <div class="account-profile-card__portrait">
            <div class="account-profile-card__avatar">
              <img :src="avatarSrc" :alt="copy.avatarAlt" @error="onProfileImageError">
              <CButton
                color="light"
                class="account-profile-card__image-edit"
                :class="{ 'is-saving': profileImageSaving }"
                :aria-label="copy.changeProfilePhoto"
                :title="copy.changeProfilePhoto"
                :disabled="profileImageSaving"
                @click="openProfileImagePicker"
              >
                <CIcon name="cil-camera" />
              </CButton>
            </div>
            <input
              ref="profileImageInput"
              type="file"
              accept="image/*"
              class="account-profile-card__image-input"
              @change="onProfileImageSelected"
            >
          </div>

          <p v-if="profileImageError" class="account-profile-card__image-error">{{ profileImageError }}</p>
          <h5 class="account-profile-card__name">{{ displayName }}</h5>

          <div class="account-profile-card__details">
            <div
              v-for="row in profileCardRows"
              :key="row.label"
              class="account-profile-card__detail-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </aside>
      </div>

      <template #footer-wrapper><div></div></template>
    </CModal>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import Service from "@/service/api";

const MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024

function pickLangValue(items, lang) {
  if (!Array.isArray(items)) return ''
  const preferred = items.find(item => item && item.key === lang && item.value)
  const english = items.find(item => item && item.key === 'en' && item.value)
  const thai = items.find(item => item && item.key === 'th' && item.value)
  const fallback = items.find(item => item && item.value)
  return String((preferred || english || thai || fallback || {}).value || '').trim()
}

function fieldValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function compactList(items) {
  return (Array.isArray(items) ? items : []).map(item => String(item || '').trim()).filter(Boolean)
}

function firstTextValue() {
  return Array.from(arguments).find(value => value !== null && value !== undefined && String(value).trim()) || ''
}

function localizedText(value, lang) {
  if (!value) return ''
  if (Array.isArray(value)) return pickLangValue(value, lang)
  if (typeof value === 'object') {
    return value.label ||
      value.name ||
      pickLangValue(value.title, lang) ||
      value.key ||
      value.code ||
      ''
  }
  return String(value).trim()
}

const HEADER_COPY = {
  en: {
    avatarAlt: 'Account photo',
    checkProfile: 'Profile Information',
    logout: 'Sign out',
    accountFallback: 'Account',
    noOrganizationData: 'No organization data',
    unit: 'Unit',
    affiliation: 'Affiliation',
    accountCode: 'Account Code',
    role: 'Role',
    email: 'Email',
    position: 'Position',
    personnelType: 'Personnel Type',
    changeProfilePhoto: 'Change profile photo',
    imageTypeError: 'Please choose an image file.',
    imageSizeError: 'Image must be smaller than 3 MB.',
    imageReadError: 'Unable to read the selected image.',
    imageSaveError: 'Unable to update profile photo.'
  },
  th: {
    avatarAlt: 'รูปบัญชีผู้ใช้',
    checkProfile: 'ข้อมูลโปรไฟล์',
    logout: 'ออกจากระบบ',
    accountFallback: 'บัญชีผู้ใช้',
    noOrganizationData: 'ไม่พบข้อมูลหน่วยงาน',
    unit: 'หน่วยงาน',
    affiliation: 'สังกัด',
    accountCode: 'Account Code',
    role: 'Role',
    email: 'อีเมล',
    position: 'ตำแหน่ง',
    personnelType: 'ประเภทบุคลากร',
    changeProfilePhoto: 'เปลี่ยนรูปโปรไฟล์',
    imageTypeError: 'กรุณาเลือกรูปภาพเท่านั้น',
    imageSizeError: 'รูปต้องมีขนาดไม่เกิน 3 MB',
    imageReadError: 'ไม่สามารถอ่านรูปที่เลือกได้',
    imageSaveError: 'ไม่สามารถอัปเดตรูปโปรไฟล์ได้'
  }
}

export default {
  name: 'TheHeaderDropdownAccnt',

  data () {
    return {
      defaultAvatar: require('@/assets/avatars/1.jpg'),
      showProfileDialog: false,
      profileImageDraft: '',
      profileImageSaving: false,
      profileImageError: '',
      avatarFailed: false
    }
  },

  methods: {
    onCheckProfile() {
      this.showProfileDialog = true
    },
    onProfileDialogShowChange(value) {
      this.showProfileDialog = !!value
    },
    openProfileImagePicker() {
      if (this.profileImageSaving) return
      this.profileImageError = ''
      if (!this.$refs.profileImageInput) return
      this.$refs.profileImageInput.value = ''
      this.$refs.profileImageInput.click()
    },
    onProfileImageSelected(event) {
      const file = event && event.target && event.target.files ? event.target.files[0] : null
      if (!file) return
      if (!file.type || !file.type.startsWith('image/')) {
        this.profileImageError = this.copy.imageTypeError
        return
      }
      if (file.size > MAX_PROFILE_IMAGE_BYTES) {
        this.profileImageError = this.copy.imageSizeError
        return
      }

      const reader = new FileReader()
      reader.onload = async (loadEvent) => {
        const image = loadEvent && loadEvent.target ? String(loadEvent.target.result || '') : ''
        if (!image) {
          this.profileImageError = this.copy.imageReadError
          return
        }
        await this.saveProfileImage(image)
      }
      reader.onerror = () => {
        this.profileImageError = this.copy.imageReadError
      }
      reader.readAsDataURL(file)
      if (event && event.target) event.target.value = ''
    },
    async saveProfileImage(image) {
      this.profileImageDraft = image
      this.profileImageError = ''
      this.profileImageSaving = true
      this.avatarFailed = false

      try {
        const response = await Service.authenticated('profile-photo', { image })
        const updatedProfile = response && response.data ? response.data.data : null
        if (updatedProfile) {
          this.$store.commit('auth/profile', updatedProfile)
        } else {
          this.$store.commit('auth/profile', Object.assign({}, this.account, {
            userinfo: Object.assign({}, this.userinfo, { image })
          }))
        }
        this.profileImageDraft = ''
      } catch (error) {
        this.profileImageDraft = ''
        this.profileImageError = this.copy.imageSaveError
      } finally {
        this.profileImageSaving = false
      }
    },
    onProfileImageError() {
      this.avatarFailed = true
    },
    onLogout() {
      this.$store.dispatch('auth/signOut')
    }
  },

  computed:{
    ...mapGetters({
      profile: 'auth/profile',
      lang: 'setting/lang'
    }),
    copy() {
      return this.lang === 'th' ? HEADER_COPY.th : HEADER_COPY.en
    },
    account() {
      return this.profile || {}
    },
    userinfo() {
      return this.account.userinfo || {}
    },
    lifecycle() {
      return this.account.lifecycle || {}
    },
    hrSnapshot() {
      return (this.account.hrContext && this.account.hrContext.snapshot) ||
        (this.lifecycle && this.lifecycle.hrSnapshot) ||
        {}
    },
    affiliations() {
      return Array.isArray(this.lifecycle && this.lifecycle.affiliations) ? this.lifecycle.affiliations : []
    },
    positions() {
      return Array.isArray(this.lifecycle && this.lifecycle.positions) ? this.lifecycle.positions : []
    },
    primaryAffiliation() {
      return this.affiliations.find(item => item && item.isPrimary) || this.affiliations[0] || {}
    },
    primaryPosition() {
      return this.positions[0] || {}
    },
    displayName() {
      const userinfo = this.userinfo
      const firstName = pickLangValue(userinfo.firstName, this.lang)
      const lastName = pickLangValue(userinfo.lastName, this.lang)
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
      return fullName || this.copy.accountFallback
    },
    organizationPath() {
      const fromLifecycle = compactList(this.primaryAffiliation.orgPath)
      const fromPosition = compactList(this.primaryPosition.orgPath)
      const fromSnapshot = compactList([
        this.hrSnapshot.orgGroupName,
        this.hrSnapshot.orgUnitName,
        this.hrSnapshot.subUnitName
      ])
      return fromLifecycle.length ? fromLifecycle : (fromPosition.length ? fromPosition : fromSnapshot)
    },
    primaryUnitLabel() {
      const pathValue = this.organizationPath[0] || ''
      return fieldValue(this.hrSnapshot.orgUnitName || this.hrSnapshot.subUnitName || pathValue || this.copy.noOrganizationData)
    },
    profileCardDescription() {
      return fieldValue(this.organizationPath.join(' / ') || this.primaryUnitLabel)
    },
    currentPositionTitle() {
      return fieldValue(firstTextValue(
        this.hrSnapshot.positionTitleName,
        this.hrSnapshot.positionName,
        this.hrSnapshot.currentPositionName,
        this.hrSnapshot.currentPosition,
        localizedText(this.primaryPosition.title, this.lang),
        localizedText(this.primaryAffiliation.title, this.lang)
      ))
    },
    personnelTypeLabel() {
      return fieldValue(firstTextValue(
        this.hrSnapshot.personnelTypeName,
        this.hrSnapshot.personnelType,
        localizedText(this.primaryPosition.type, this.lang)
      ))
    },
    roleLabel() {
      const groups = Array.isArray(this.account.securityGroups) ? this.account.securityGroups : []
      const firstGroup = groups.find(item => item && (item.label || item.name || item.title))
      return fieldValue(firstTextValue(
        localizedText(firstGroup, this.lang),
        localizedText(this.account.roleName, this.lang),
        localizedText(this.account.role, this.lang),
        localizedText(this.account.type, this.lang)
      ))
    },
    profileCardRows() {
      const path = this.organizationPath.length ? this.organizationPath : compactList(String(this.profileCardDescription || '').split('/'))
      const unit = fieldValue(path[0] || this.primaryUnitLabel)
      const affiliation = fieldValue(path.slice(1).join(' / '))
      return [
        { label: this.copy.accountCode, value: fieldValue(this.account.code || this.account.zid) },
        { label: this.copy.role, value: this.roleLabel },
        { label: this.copy.email, value: fieldValue(this.account.email) },
        { label: this.copy.unit, value: unit },
        { label: this.copy.affiliation, value: affiliation },
        { label: this.copy.position, value: this.currentPositionTitle },
        { label: this.copy.personnelType, value: this.personnelTypeLabel }
      ]
    },
    profileImageSrc() {
      const profile = this.account
      const userinfo = this.userinfo
      const imageProfile = userinfo.imageProfile || {}
      const authen = Array.isArray(profile.authen) ? profile.authen : []
      const authenImage = authen.map(item => item && (item.picture || item.image || item.photoURL)).find(Boolean)
      return userinfo.image ||
        (imageProfile && imageProfile.src ? imageProfile.src : '') ||
        userinfo.picture ||
        userinfo.googlePicture ||
        profile.image ||
        profile.picture ||
        profile.googlePicture ||
        authenImage ||
        ''
    },
    avatarSrc() {
      if (this.avatarFailed) return this.defaultAvatar
      return this.profileImageDraft ||
        this.profileImageSrc ||
        this.defaultAvatar
    }
  },

  watch: {
    profileImageSrc() {
      this.avatarFailed = false
    }
  }
}
</script>

<style scoped>
  .c-icon {
    margin-right: 0.3rem;
  }
  .c-header-nav .dropdown-item{
    min-width: 250px;
  }

  .account-header-shell {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .account-header-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    padding: 0.35rem 0.25rem 0.35rem 0.75rem;
    color: #17233c;
  }

  .account-header-toggle__identity {
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: 168px;
    line-height: 1.15;
  }

  .account-header-toggle__name {
    display: block;
    max-width: 100%;
    overflow: hidden;
    color: #1d2a44;
    font-size: 0.875rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-header-toggle__avatar {
    width: 35px;
    height: 35px;
    flex: 0 0 35px;
    overflow: hidden;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(26, 38, 62, 0.08), 0 6px 14px rgba(26, 38, 62, 0.14);
  }

  .account-header-toggle__avatar .c-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .account-profile-modal ::v-deep .modal-content {
    border: 0;
    border-radius: 8px;
    background: transparent;
    box-shadow: none;
  }

  .account-profile-modal ::v-deep .modal-dialog {
    max-width: 480px;
  }

  .account-profile-modal ::v-deep .modal-body {
    padding: 0;
  }

  .account-profile-dialog {
    display: flex;
    justify-content: center;
    padding: 0;
  }

  .account-profile-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    max-height: calc(100vh - 56px);
    border: 1px solid #eadde0;
    border-radius: 8px;
    background: linear-gradient(180deg, #fffaf9 0%, #ffffff 38%, #f8fbfa 100%);
    position: relative;
    overflow: hidden;
    padding: 1.35rem 0.95rem 1rem;
    box-shadow: 0 20px 46px rgba(56, 18, 24, 0.2);
  }

  .account-profile-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #8f101c 0%, #c99a2e 52%, #24b3a7 100%);
  }

  .account-profile-card__portrait {
    display: flex;
    justify-content: center;
    padding-top: 0.15rem;
  }

  .account-profile-card__avatar {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 76px;
    height: 76px;
    flex: 0 0 76px;
    overflow: hidden;
    border-radius: 50%;
    border: 4px solid #ffffff;
    background: #fff7f6;
    color: #8f101c;
    font-size: 1.35rem;
    font-weight: 900;
    line-height: 1;
    box-shadow: 0 0 0 2px rgba(36, 179, 167, 0.68), 0 10px 24px rgba(143, 16, 28, 0.14);
  }

  .account-profile-card__avatar img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .account-profile-card__image-input {
    display: none;
  }

  .account-profile-card__image-edit {
    position: absolute;
    right: 3px;
    bottom: 3px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    min-width: 25px;
    height: 25px;
    padding: 0;
    border: 1px solid rgba(143, 16, 28, 0.18);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.96);
    color: #75111b;
    box-shadow: 0 4px 10px rgba(56, 18, 24, 0.18);
  }

  .account-profile-card__image-edit .c-icon {
    width: 13px;
    height: 13px;
    margin-right: 0;
  }

  .account-profile-card__image-edit.is-saving {
    opacity: 0.72;
    cursor: wait;
  }

  .account-profile-card__image-error {
    margin: 0.72rem auto 0;
    max-width: 88%;
    color: #8f101c;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
  }

  .account-profile-card__name {
    min-width: 0;
    margin: 0.8rem 0 0;
    color: #5f1119;
    font-size: 0.95rem;
    font-weight: 800;
    line-height: 1.32;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .account-profile-card__details {
    min-width: 0;
    overflow-y: auto;
    margin-top: 1.35rem;
    padding-right: 0.18rem;
    border-top: 1px solid #eadde0;
    background: rgba(255, 255, 255, 0.54);
  }

  .account-profile-card__detail-row {
    display: grid;
    grid-template-columns: minmax(128px, auto) minmax(0, 1fr);
    align-items: start;
    gap: 0.65rem;
    min-width: 0;
    padding: 0.46rem 0;
    border-bottom: 1px solid #eee4e6;
  }

  .account-profile-card__detail-row span {
    color: #8b6f78;
    font-size: 0.66rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .account-profile-card__detail-row strong {
    min-width: 0;
    margin: 0;
    color: #26313d;
    font-size: 0.76rem;
    font-weight: 600;
    line-height: 1.35;
    text-align: right;
    overflow-wrap: anywhere;
  }

  @media (max-width: 575.98px) {
    .account-profile-modal ::v-deep .modal-dialog {
      max-width: calc(100vw - 32px);
      margin: 1.25rem auto;
    }

    .account-profile-card {
      max-height: calc(100vh - 40px);
    }

    .account-profile-card__detail-row {
      grid-template-columns: minmax(104px, auto) minmax(0, 1fr);
    }

    .account-header-toggle__identity {
      display: none;
    }

    .account-header-toggle {
      padding-left: 0.35rem;
    }
  }
</style>
