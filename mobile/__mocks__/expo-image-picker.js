// Mock for expo-image-picker — used in tests and when the native module is unavailable.
module.exports = {
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    cancelled: true,
    uri: undefined,
    fileSize: undefined,
  }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
};