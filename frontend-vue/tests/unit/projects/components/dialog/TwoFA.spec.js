import { shallowMount } from '@vue/test-utils'
import TwoFA from '@/projects/components/dialog/TwoFA.vue'

function mountTwoFA() {
  return shallowMount(TwoFA, {
    stubs: ['CModal', 'CRow', 'CCol', 'CForm', 'TrustDeviceDialog'],
    mocks: {
      $t: key => key,
      $store: {
        getters: {
          'auth/is2FA': true,
          'auth/profile': { email: 'user@mfu.ac.th' }
        },
        dispatch: jest.fn().mockResolvedValue(true),
        commit: jest.fn()
      }
    }
  })
}

describe('projects/components/dialog/TwoFA', () => {
  test('normalizes pasted OTP text from email content', () => {
    const wrapper = mountTwoFA()

    expect(wrapper.vm.normalizeOtpCode('Your verification code is 123456.'))
      .toBe('123456')
    expect(wrapper.vm.normalizeOtpCode('123 456'))
      .toBe('123456')
  })

  test('pastes OTP into every input and submits the completed code', () => {
    const wrapper = mountTwoFA()
    const dispatchOtpCode = jest.spyOn(wrapper.vm, 'dispatchOtpCode').mockImplementation(jest.fn())
    const preventDefault = jest.fn()

    wrapper.vm.onPasteOtp({
      clipboardData: {
        getData: () => 'Your verification code is 123456.'
      },
      preventDefault
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(wrapper.vm.otpInputs).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(dispatchOtpCode).toHaveBeenCalledWith('123456')
  })
})
