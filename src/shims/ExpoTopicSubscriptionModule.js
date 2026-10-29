const { requireOptionalNativeModule } = require("expo-modules-core");

const native = requireOptionalNativeModule("ExpoTopicSubscriptionModule");

module.exports =
  native ??
  {
    addListener() {},
    removeListeners() {},
    subscribeToTopicAsync: async () => null,
    unsubscribeFromTopicAsync: async () => null,
  };
