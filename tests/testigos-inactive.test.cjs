const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDataApi(disabledValue = true) {
  const sourcePath = path.join(__dirname, "..", "mira-data.js");
  const source = fs.readFileSync(sourcePath, "utf8")
    .replace("export const MIRA_DATA =", "const MIRA_DATA =");

  const metrics = { fetchCalls: 0, tokenCalls: 0 };
  const window = {
    MIRA_TESTIGOS_TEMP_DISABLED: disabledValue,
    MIRA_AUTH: {
      async getJWTToken() {
        metrics.tokenCalls += 1;
        return "test-token";
      },
      async getAnonymousToken() {
        metrics.tokenCalls += 1;
        return { data: { token: "anonymous-test-token" } };
      }
    },
    dispatchEvent() {}
  };

  const context = vm.createContext({
    window,
    Headers,
    URLSearchParams,
    Blob,
    Event: class Event {
      constructor(type) { this.type = type; }
    },
    fetch: async () => {
      metrics.fetchCalls += 1;
      return { ok: true, async text() { return "[]"; } };
    },
    console,
    Date
  });

  vm.runInContext(source + "\nglobalThis.__MIRA_DATA__ = MIRA_DATA;", context, {
    filename: "mira-data.js"
  });

  return { api: context.__MIRA_DATA__, metrics };
}

const disabledOperations = [
  ["listPublicWitnesses", api => api.listPublicWitnesses()],
  ["updatePublicWitness", api => api.updatePublicWitness("fake-id", {})],
  ["listWitnessFiles", api => api.listWitnessFiles()],
  ["e14Request", api => api.e14Request("list")],
  ["listE14Evidence", api => api.listE14Evidence()],
  ["uploadE14Evidence", api => api.uploadE14Evidence({})],
  ["getE14Download", api => api.getE14Download("fake-id")]
];

test("todas las rutas de datos de Testigos fallan cerradas mientras el módulo está inactivo", async t => {
  for (const [name, invoke] of disabledOperations) {
    await t.test(name, async () => {
      const { api, metrics } = loadDataApi(true);
      await assert.rejects(
        async () => invoke(api),
        /temporalmente inactivo/
      );
      assert.equal(metrics.tokenCalls, 0, "no debe solicitar tokens para Testigos");
      assert.equal(metrics.fetchCalls, 0, "no debe realizar peticiones de red para Testigos");
    });
  }
});

test("la barrera también se mantiene activa cuando la bandera no está definida", async () => {
  const { api, metrics } = loadDataApi(undefined);
  await assert.rejects(async () => api.listPublicWitnesses(), /temporalmente inactivo/);
  assert.equal(metrics.tokenCalls, 0);
  assert.equal(metrics.fetchCalls, 0);
});

test("los módulos operativos no quedan bloqueados por la barrera temporal de Testigos", async () => {
  const { api, metrics } = loadDataApi(false);
  const rows = await api.listActivities({ limit: 5 });
  assert.equal(Array.from(rows).length, 0);
  assert.equal(metrics.tokenCalls, 1);
  assert.equal(metrics.fetchCalls, 1);
});
