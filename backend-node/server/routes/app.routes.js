const accountRoutes = require("../Project/accounts/accounts.routes");
const aibasedautomaticnetworkconfigurationsystemRoutes = require("../Project/aibasedautomaticnetworkconfigurationsystem/aibasedautomaticnetworkconfigurationsystem.routes");
const securityRoutes = require("../Project/security/security.routes");
const settingsRoutes = require("../Project/settings/settings.routes");

module.exports = function (app) {
  const path = "/api/v1";

  app.use(path + '/aibasedautomaticnetworkconfigurationsystem', aibasedautomaticnetworkconfigurationsystemRoutes);
  app.use(path + '/setting', settingsRoutes);
  app.use(path + '/security', securityRoutes);
  app.use(path, accountRoutes);
};
