class TestPlugin {
  constructor() {
    this.metadata = {
      name: "test-plugin",
      version: "1.0.0",
      dependencies: [],
    };
  }

  initialize() {
    return Promise.resolve();
  }

  shutdown() {
    return Promise.resolve();
  }

  status() {
    return "INITIALIZED";
  }
}

module.exports = { default: TestPlugin };
