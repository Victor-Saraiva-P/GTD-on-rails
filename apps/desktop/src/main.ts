import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="shell">
    <span class="eyebrow">desktop skeleton</span>
    <h1>GTD on Rails</h1>
    <p>
      Base visual minima do app desktop. A interface de produto entra depois,
      sem acoplar a inicializacao do monorepo ao dominio.
    </p>
  </main>
`;

