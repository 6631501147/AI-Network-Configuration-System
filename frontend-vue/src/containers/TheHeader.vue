<template>
  <CHeader with-subheader>
    <CHeaderBrand class="mr-auto px-3" to="/">
      <img src="@/assets/logo.svg" height="52" class="mr-2"/>
      <span class="font-weight-bold text-dark" style="font-size: 1.6rem; letter-spacing: 1px;">MFU</span>
    </CHeaderBrand>

    <CHeaderNav>
      <TheHeaderDropdownAccnt class="pr-3"/>
    </CHeaderNav>
  </CHeader>
</template>

<script>
import TheHeaderDropdownAccnt from './TheHeaderDropdownAccnt'

export default {
  name: 'TheHeader',
  components: {
    TheHeaderDropdownAccnt,
  }
}
</script>
