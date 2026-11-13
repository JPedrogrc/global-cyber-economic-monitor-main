import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const failingFeed = () => vi.fn().mockRejectedValue(new Error("CORS"));

async function renderApp(fetchFeeds = failingFeed()) {
  const user = userEvent.setup();
  render(<App fetchFeeds={fetchFeeds} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /atualizar feeds/i })).toBeEnabled(),
  );
  return { user, fetchFeeds };
}

const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("App — integração dos filtros geográficos", () => {
  it("estado e município começam desabilitados", async () => {
    await renderApp();
    expect(screen.getByLabelText("Estado / Província")).toBeDisabled();
    expect(screen.getByLabelText("Município")).toBeDisabled();
    expect(tableRows()).toHaveLength(14);
  });

  it("drill-down País -> Estado -> Município filtra a tabela", async () => {
    const { user } = await renderApp();

    await user.selectOptions(screen.getByLabelText("País / Região"), "BR");
    expect(tableRows()).toHaveLength(8);

    await user.selectOptions(screen.getByLabelText("Estado / Província"), "SP");
    expect(tableRows()).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText("Município"), "Campinas");
    expect(tableRows()).toHaveLength(1);
    expect(screen.getByText("Magazine Luiza / Varejo Digital")).toBeInTheDocument();
  });

  it("trocar o país zera estado e município (reset em cascata)", async () => {
    const { user } = await renderApp();
    await user.selectOptions(screen.getByLabelText("País / Região"), "BR");
    await user.selectOptions(screen.getByLabelText("Estado / Província"), "AM");
    await user.selectOptions(screen.getByLabelText("Município"), "Manaus");

    await user.selectOptions(screen.getByLabelText("País / Região"), "US");

    expect(screen.getByLabelText("Estado / Província")).toHaveValue("ALL");
    expect(screen.getByLabelText("Município")).toHaveValue("ALL");
    expect(screen.getByLabelText("Município")).toBeDisabled();
    expect(tableRows()).toHaveLength(2);
  });

  it("mostra mensagem de vazio quando nada corresponde à busca", async () => {
    const { user } = await renderApp();
    await user.type(screen.getByLabelText(/buscar organização/i), "inexistente");
    expect(screen.getByText(/nenhuma organização encontrada/i)).toBeInTheDocument();
    expect(screen.getByText("0 registros")).toBeInTheDocument();
  });
});

describe("App — segurança na renderização", () => {
  it("payload XSS digitado na busca não é interpretado como HTML", async () => {
    const { user } = await renderApp();
    await user.type(screen.getByLabelText(/buscar organização/i), "<img src=x onerror=alert(1)>");
    expect(document.querySelector("img")).toBeNull();
  });

  it("dados do feed são exibidos como texto, nunca como HTML", async () => {
    const fetchFeeds = vi.fn().mockResolvedValue({
      infocon: "GREEN",
      topIps: [
        {
          id: "x",
          agency: "SANS ISC / DShield",
          ip: "1.1.1.1",
          port: 22,
          threatType: "<b id='evil'>bold</b>",
          targetSector: "NÃO CLASSIFICADO",
          severity: "NÃO CLASSIFICADA",
          status: "OBSERVADO",
          isDemo: false,
        },
      ],
    });
    await renderApp(fetchFeeds);
    expect(await screen.findByText("<b id='evil'>bold</b>")).toBeInTheDocument();
    expect(document.getElementById("evil")).toBeNull();
  });
});

describe("App — falhas nos feeds OSINT", () => {
  it("com SANS ISC fora do ar exibe aviso e registros de demonstração", async () => {
    await renderApp();
    expect(screen.getByTestId("feed-status")).toHaveTextContent(/indisponível/);
    const feed = screen.getByRole("list", { name: /registros osint/i });
    expect(within(feed).getAllByText("DEMONSTRAÇÃO").length).toBeGreaterThan(0);
  });

  it("com sucesso exibe Infocon e o IP observado", async () => {
    const fetchFeeds = vi.fn().mockResolvedValue({
      infocon: "YELLOW",
      topIps: [
        {
          id: "s",
          agency: "SANS ISC / DShield",
          ip: "45.148.10.240",
          port: 22,
          threatType: "IP observado no Top Attackers (5 eventos)",
          targetSector: "NÃO CLASSIFICADO",
          severity: "NÃO CLASSIFICADA",
          status: "OBSERVADO",
          isDemo: false,
        },
      ],
    });
    await renderApp(fetchFeeds);
    expect(screen.getByTestId("infocon-level")).toHaveTextContent("YELLOW");
    expect(screen.getByText("45.148.10.240")).toBeInTheDocument();
    expect(screen.queryByText("DEMONSTRAÇÃO")).toBeNull();
  });

  it("botão Atualizar Feeds dispara nova consulta", async () => {
    const { user, fetchFeeds } = await renderApp();
    await user.click(screen.getByRole("button", { name: /atualizar feeds/i }));
    await waitFor(() => expect(fetchFeeds).toHaveBeenCalledTimes(2));
  });
});

describe("App — UX e acessibilidade", () => {
  it("modal de API abre, recebe foco e fecha com Esc", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: /api & arquitetura/i }));

    const dialog = screen.getByRole("dialog", { name: /portabilidade de api/i });
    expect(within(dialog).getByRole("button", { name: "Fechar modal" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("botão de simulação alterna o estado (aria-pressed)", async () => {
    const { user } = await renderApp();
    const toggle = screen.getByRole("button", { name: /simular carga elevada/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: /parar simulação/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
