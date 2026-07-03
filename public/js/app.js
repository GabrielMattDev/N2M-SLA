// ============================================================
// N2M SLA - Relatorio de Tratativas v3.8
// Layout simplificado: filtros + tabela + modal
// Ajustes v3.8:
//   - Código 19 e 20 = Liberado (sem SLA, fim da contagem)
//   - SLA acumulado por SETOR (tempo que nota ficou em cada setor)
//   - Tempo Total = soma de todos os tempos acumulados
//   - Ordenacao: maior SLA primeiro
//   - Filtro: Pendente / Liberado / Todos
//   - Alerta vermelho para notas com tempo total > 2h
//   - Timeline: "Tempo de Etapa" mostra tempo real entre linha e proxima
// ============================================================

const API_BASE = window.location.origin;

// ============================================================
// MAPEAMENTO COMPLETO DE SETORES (stus_nota / stus_plca)
// ============================================================
const MAPEAMENTO_SETORES = {
  '9999':  { etapa: 'RM Loja Início',              limite: 0.5, nome: 'RM Loja Início',   icone: 'fa-store',       cor: '#06b6d4', ordem: 1,  grupo: 'rm' },
  '18':    { etapa: 'RM Central',                    limite: 0.5, nome: 'RM Central',       icone: 'fa-warehouse',   cor: '#6366f1', ordem: 2,  grupo: 'rm' },
  '10073': { etapa: 'Comercial Linha Seca',          limite: 0.5, nome: 'Comercial Linha Seca', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10074': { etapa: 'Comercial Perecíveis',          limite: 0.5, nome: 'Comercial Perecíveis', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10075': { etapa: 'Comercial Bazar',               limite: 0.5, nome: 'Comercial Bazar',  icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10076': { etapa: 'Comercial Perfumaria',          limite: 0.5, nome: 'Comercial Perfumaria', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10077': { etapa: 'Comercial Limpeza',             limite: 0.5, nome: 'Comercial Limpeza', icone: 'fa-handshake',  cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10078': { etapa: 'Comercial Mercearia',           limite: 0.5, nome: 'Comercial Mercearia', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10080': { etapa: 'Comercial Perfumaria Uso Pessoal', limite: 0.5, nome: 'Comercial Perfumaria Uso Pessoal', icone: 'fa-handshake', cor: '#a855f7', ordem: 3, grupo: 'comercial' },
  '10081': { etapa: 'Comercial Hort',                limite: 0.5, nome: 'Comercial Hort',   icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10082': { etapa: 'Cadastro',                      limite: 0.5, nome: 'Cadastro',         icone: 'fa-id-card',     cor: '#ef4444', ordem: 4,  grupo: 'cadastro' },
  '10083': { etapa: 'Encerramento',                  limite: 0,   nome: 'Encerramento',     icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10084': { etapa: 'Tributário',                    limite: 0.5, nome: 'Tributário',       icone: 'fa-calculator',  cor: '#f59e0b', ordem: 4,  grupo: 'tributario' },
  '10085': { etapa: 'Encerramento',                  limite: 0,   nome: 'Encerramento',     icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10086': { etapa: 'Erro RM Loja',                  limite: 0.5, nome: 'Erro RM Loja',     icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 1, grupo: 'erro' },
  '10087': { etapa: 'Encerramento',                  limite: 0,   nome: 'Encerramento',     icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10090': { etapa: 'Comercial Bomboniere',          limite: 0.5, nome: 'Comercial Bomboniere', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10096': { etapa: 'Comercial Mercearia Doce',      limite: 0.5, nome: 'Comercial Mercearia Doce', icone: 'fa-handshake', cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10098': { etapa: 'Erro RM Central',               limite: 0.5, nome: 'Erro RM Central',  icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 2, grupo: 'erro' },
  '19':    { etapa: 'Liberado',                      limite: 0,   nome: 'Liberado',         icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '20':    { etapa: 'Liberado',                      limite: 0,   nome: 'Liberado',         icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' }
};

// Códigos que representam fim do SLA (liberado/coletada)
const CODIGOS_FIM_SLA = ['19', '20'];

// Status pills CSS classes por grupo
const STATUS_PILLS = {
  'rm': 'rm', 'comercial': 'comercial', 'cadastro': 'cadastro',
  'tributario': 'tributario', 'encerramento': 'liberado', 'erro': 'cadastro', 'liberado': 'liberado'
};

let dadosNotas = [];
let dadosFiltrados = [];
let paginaAtual = 1;
let itensPorPagina = 25;
let notaAtualDetalhes = null;

// ============================================================
// INICIALIZACAO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  document.getElementById('filterDataFim').value = formatarDataInput(hoje);
  document.getElementById('filterDataInicio').value = formatarDataInput(seteDiasAtras);
  carregarLojas();
  aplicarFiltros();
  verificarStatusDB();
});

// ============================================================
// API CALLS
// ============================================================
async function fetchAPI(endpoint, params = {}) {
  const url = new URL(API_BASE + endpoint);
  Object.keys(params).forEach(key => {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      url.searchParams.append(key, params[key]);
    }
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erro na API: ' + response.status);
  return await response.json();
}

async function carregarLojas() {
  try {
    const data = await fetchAPI('/api/lojas');
    const select = document.getElementById('filterLoja');
    select.innerHTML = '<option value="Todas">Todas</option>';
    if (data.success && data.data) {
      data.data.forEach(loja => {
        const option = document.createElement('option');
        option.value = loja.codi_loja;
        option.textContent = loja.nome_loja || 'Loja ' + loja.codi_loja;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erro ao carregar lojas:', error);
  }
}

async function verificarStatusDB() {
  try {
    const data = await fetchAPI('/health');
    const dot = document.getElementById('dbStatusDot');
    const text = document.getElementById('dbStatusText');
    if (data.status === 'ok') {
      dot.style.background = 'var(--success)';
      dot.style.boxShadow = '0 0 8px var(--success)';
      text.textContent = 'Conectado';
    } else {
      dot.style.background = 'var(--danger)';
      text.textContent = 'Desconectado';
    }
  } catch (error) {
    const dot = document.getElementById('dbStatusDot');
    dot.style.background = 'var(--danger)';
    text.textContent = 'Desconectado';
  }
}

// ============================================================
// FILTROS E BUSCA
// ============================================================
async function aplicarFiltros() {
  mostrarLoading(true);
  try {
    const params = {
      dataInicio: document.getElementById('filterDataInicio').value,
      dataFim: document.getElementById('filterDataFim').value,
      loja: document.getElementById('filterLoja').value,
      nota: document.getElementById('filterNota').value,
      fornecedor: document.getElementById('filterFornecedor').value,
      status: document.getElementById('filterStatus').value  // v3.8: novo filtro de status
    };
    const data = await fetchAPI('/api/notas', params);
    if (data.success) {
      dadosNotas = data.data || [];
      dadosFiltrados = [...dadosNotas];
      paginaAtual = 1;
      renderTabela();
      mostrarToast(data.total + ' notas carregadas!', 'success');
    } else {
      mostrarToast(data.error || 'Erro ao carregar dados', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    mostrarToast('Erro ao conectar: ' + error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

function limparFiltros() {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  document.getElementById('filterDataInicio').value = formatarDataInput(seteDiasAtras);
  document.getElementById('filterDataFim').value = formatarDataInput(hoje);
  document.getElementById('filterLoja').value = 'Todas';
  document.getElementById('filterNota').value = '';
  document.getElementById('filterFornecedor').value = '';
  document.getElementById('filterStatus').value = 'todos';  // v3.8: resetar status
  aplicarFiltros();
}

// ============================================================
// RENDER TABELA
// ============================================================
function renderTabela() {
  const content = document.getElementById('dashboardContent');
  if (!dadosFiltrados || dadosFiltrados.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h3>Nenhuma nota encontrada</h3>
        <p>Ajuste os filtros acima para buscar notas fiscais</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="fas fa-list"></i> Notas Fiscais - Detalhamento</div>
        <div class="table-actions">
          <span style="color: var(--text-muted); font-size: 0.8rem;">
            <i class="fas fa-sort-amount-down"></i> Ordenado por: <strong>Maior SLA</strong>
          </span>
        </div>
      </div>
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-search">
            <i class="fas fa-search"></i>
            <input type="text" id="tableSearch" placeholder="Buscar NF, fornecedor..." oninput="filtrarTabelaLocal()">
          </div>
          <div class="table-actions">
            <select id="tableRows" onchange="mudarPagina(1)" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; outline: none; font-family: inherit;">
              <option value="25">25 por pagina</option>
              <option value="50">50 por pagina</option>
              <option value="100">100 por pagina</option>
              <option value="200">200 por pagina</option>
            </select>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>NF</th>
                <th>Fornecedor</th>
                <th>Loja</th>
                <th>Emissao</th>
                <th>Etapa Atual</th>
                <th>Tempo Total</th>
                <th>SLA</th>
                <th>Movs</th>
                <th>Acoes</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
        <div class="table-footer">
          <div class="table-info" id="tableInfo"></div>
          <div class="pagination" id="pagination"></div>
        </div>
      </div>
    </div>
  `;
  atualizarTabela();
}

function atualizarTabela() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const pagina = dadosFiltrados.slice(inicio, fim);

  let html = '';
  for (const d of pagina) {
    const config = MAPEAMENTO_SETORES[d.etapaAtualCodigo] || MAPEAMENTO_SETORES[d.etapaAtual] || { grupo: 'rm', nome: d.etapaAtual };
    const grupo = config.grupo || 'rm';
    const pillClass = STATUS_PILLS[grupo] || 'rm';

    let slaTexto, slaClass;
    if (d.isLiberado) {
      slaTexto = 'Liberado';
      slaClass = 'liberado';
    } else {
      slaTexto = d.pctSLA > 100 ? 'Fora' : d.pctSLA > 80 ? 'Alerta' : 'OK';
      slaClass = d.statusSLA;
    }

    // v3.8: Alerta vermelho na linha se tempo total > 2h e nao liberado
    const alertaHtml = (d.alertaVermelho && !d.isLiberado) 
      ? '<span class="alerta-vermelho" title="Tempo total estourou 2h"><i class="fas fa-exclamation-circle"></i></span>' 
      : '';

    // v3.8: Classe CSS para linha com alerta
    const rowClass = (d.alertaVermelho && !d.isLiberado) ? 'row-alerta' : '';

    html += `<tr class="${rowClass}">
      <td class="td-nf">${d.num_nota}</td>
      <td>${d.nome_forn}</td>
      <td>${d.codi_loja}</td>
      <td>${formatarData(d.dataPrimeiroLog || d.dtha_lanc)}</td>
      <td><span class="status-pill ${pillClass}"><i class="fas fa-circle"></i> ${d.isLiberado ? 'Liberado' : (config.nome || d.etapaAtual)}</span></td>
      <td>${formatarMinutos(d.tempoTotalHoras)}</td>
      <td><span class="sla-dot ${slaClass}"></span> ${slaTexto} ${d.isLiberado ? '' : '(' + d.pctSLA.toFixed(0) + '%)'}</td>
      <td>${d.totalMovimentacoes}</td>
      <td><button class="btn-table btn-ver" data-codi="${d.codi_lanc}"><i class="fas fa-eye"></i> Ver</button></td>
      <td>${alertaHtml}</td>
    </tr>`;
  }

  tbody.innerHTML = html;
  document.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', function() { verDetalhes(this.dataset.codi); });
  });

  const info = document.getElementById('tableInfo');
  if (info) {
    const total = dadosFiltrados.length;
    const mostrando = Math.min(total, inicio + pagina.length);
    info.textContent = `Mostrando ${inicio + 1} a ${mostrando} de ${total} registros`;
  }
  atualizarPaginacao();
}

function atualizarPaginacao() {
  const container = document.getElementById('pagination');
  if (!container) return;
  const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
  if (totalPaginas <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina(1)"><i class="fas fa-angle-double-left"></i></button>`;
  html += `<button class="page-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual - 1})"><i class="fas fa-angle-left"></i></button>`;
  const inicioPg = Math.max(1, paginaAtual - 2);
  const fimPg = Math.min(totalPaginas, paginaAtual + 2);
  for (let i = inicioPg; i <= fimPg; i++) {
    html += `<button class="page-btn ${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual + 1})"><i class="fas fa-angle-right"></i></button>`;
  html += `<button class="page-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina(${totalPaginas})"><i class="fas fa-angle-double-right"></i></button>`;
  container.innerHTML = html;
}

function mudarPagina(pagina) {
  const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
  if (pagina < 1 || pagina > totalPaginas) return;
  paginaAtual = pagina;
  itensPorPagina = parseInt(document.getElementById('tableRows').value);
  atualizarTabela();
}

function filtrarTabelaLocal() {
  const termo = document.getElementById('tableSearch').value.toLowerCase();
  if (!termo) {
    dadosFiltrados = [...dadosNotas];
  } else {
    dadosFiltrados = dadosNotas.filter(d =>
      d.num_nota.toLowerCase().includes(termo) ||
      d.nome_forn.toLowerCase().includes(termo) ||
      d.codi_loja.toString().includes(termo)
    );
  }
  paginaAtual = 1;
  atualizarTabela();
}

// ============================================================
// MODAL DETALHES PRINCIPAL
// ============================================================
async function verDetalhes(codi_lanc) {
  mostrarLoading(true);
  try {
    const data = await fetchAPI(`/api/notas/${codi_lanc}`);
    if (!data.success || !data.data) {
      mostrarToast('Nota nao encontrada', 'error');
      mostrarLoading(false);
      return;
    }
    const nf = data.data;
    notaAtualDetalhes = nf;
    const body = document.getElementById('modalBody');

    // Header info - 6 campos
    let html = `<div class="detail-grid">`;
    html += `<div class="detail-item"><div class="detail-label">Codigo Lancamento</div><div class="detail-value">${nf.codi_lanc}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Numero da NF</div><div class="detail-value">${nf.num_nota}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Fornecedor</div><div class="detail-value">${nf.nome_forn}</div></div>`;
    html += `</div>`;

    html += `<div class="detail-grid" style="margin-top: 12px;">`;
    html += `<div class="detail-item"><div class="detail-label">Loja</div><div class="detail-value">${nf.codi_loja}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Data do Lancamento</div><div class="detail-value">${formatarDataHora(nf.dataPrimeiroLog || nf.dtha_lanc)}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Status Atual</div><div class="detail-value">${nf.status_geral}</div></div>`;
    html += `</div>`;

    html += `<div class="detail-grid" style="margin-top: 12px;">`;
    const corEtapa = nf.isLiberado ? 'var(--success)' : (nf.statusSLA === 'danger' ? 'var(--danger)' : nf.statusSLA === 'warning' ? 'var(--warning)' : 'var(--success)');
    html += `<div class="detail-item"><div class="detail-label">Etapa Atual</div><div class="detail-value" style="color: ${corEtapa};">${nf.etapaAtual}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Tempo Total</div><div class="detail-value">${formatarMinutos(nf.tempoTotalHoras)}</div></div>`;
    html += `<div class="detail-item"><div class="detail-label">Movimentacoes</div><div class="detail-value">${nf.totalMovimentacoes}</div></div>`;
    html += `</div>`;

    // Tempos por Etapa - acumulados por setor
    html += `<div style="margin-top: 24px;">
      <div class="timeline-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span><i class="fas fa-clock"></i> Tempos por Etapa (Acumulado)</span>
        <button class="btn-table" onclick="verMovimentacoes()" style="padding: 6px 14px; font-size: 0.8rem;">
          <i class="fas fa-eye"></i> Ver Movimentacoes
        </button>
      </div>`;

    // Exibir tempos acumulados por setor
    if (nf.temposPorSetor) {
      Object.keys(nf.temposPorSetor).forEach(etapa => {
        const tempo = nf.temposPorSetor[etapa];
        // Encontra config do setor
        let config = null;
        for (const cod in MAPEAMENTO_SETORES) {
          if (MAPEAMENTO_SETORES[cod].etapa === etapa) {
            config = MAPEAMENTO_SETORES[cod];
            break;
          }
        }
        const limite = config ? config.limite : 0.5;
        const pct = (limite > 0 && !nf.isLiberado) ? (tempo / limite) * 100 : 0;
        const cor = pct > 100 ? 'var(--danger)' : pct > 80 ? 'var(--warning)' : 'var(--success)';
        const icone = config ? config.icone : 'fa-circle';
        const corIcone = config ? config.cor : '#64748b';

        html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
          <span style="font-size: 0.85rem;"><i class="fas ${icone}" style="color: ${corIcone}; margin-right: 8px;"></i>${etapa}</span>
          <span style="font-weight: 600; color: ${cor}; font-size: 0.85rem;">${formatarMinutos(tempo)} / 30min (${pct.toFixed(0)}%)</span>
        </div>`;
      });
    }
    html += `</div>`;

    body.innerHTML = html;
    document.getElementById('modalDetalhes').classList.add('active');
  } catch (error) {
    console.error('Erro ao carregar detalhes:', error);
    mostrarToast('Erro ao carregar detalhes', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function fecharModal() {
  document.getElementById('modalDetalhes').classList.remove('active');
  notaAtualDetalhes = null;
}

// ============================================================
// SUB-MODAL: MOVIMENTACOES DETALHADAS
// ============================================================
function verMovimentacoes() {
  if (!notaAtualDetalhes || !notaAtualDetalhes.timeline) {
    mostrarToast('Nenhuma movimentacao disponivel', 'error');
    return;
  }

  const nf = notaAtualDetalhes;
  // v3.8: Usa timeline do backend (que tem tempo real por etapa)
  const timeline = nf.timeline;

  let subModal = document.getElementById('subModalMovs');
  if (!subModal) {
    subModal = document.createElement('div');
    subModal.id = 'subModalMovs';
    subModal.className = 'modal-overlay';
    subModal.onclick = function(e) { if(e.target === this) fecharSubModal(); };
    subModal.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-header">
          <h2><i class="fas fa-exchange-alt"></i> Movimentacoes da Nota</h2>
          <button class="modal-close" onclick="fecharSubModal()">&times;</button>
        </div>
        <div class="modal-body" id="subModalBody"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="fecharSubModal()">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);
  }

  const body = document.getElementById('subModalBody');

  // Info da nota
  let html = `<div style="margin-bottom: 20px; padding: 12px; background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border);">
    <strong>NF:</strong> ${nf.num_nota} | <strong>Fornecedor:</strong> ${nf.nome_forn} | <strong>Total Movs:</strong> ${timeline.length}
    ${nf.isLiberado ? ' | <span style="color: var(--success);"><i class="fas fa-check-circle"></i> Liberado</span>' : ''}
  </div>`;

  // Tabela de movimentacoes
  html += `<div class="mov-table-wrapper">
    <table class="mov-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Data/Hora</th>
          <th>Placa</th>
          <th>Setor (Linha)</th>
          <th>Status Placa</th>
          <th>Tipo Proc</th>
          <th>Status Nota</th>
          <th>Tipo Proc Nota</th>
          <th>Tempo de Etapa</th>
        </tr>
      </thead>
      <tbody>`;

  // v3.8: Usa timeline do backend em vez de movimentacoes brutas
  timeline.forEach((mov, idx) => {
    const mapeamento = MAPEAMENTO_SETORES[mov.st_nota];
    const etapa = mov.etapa || ('Placa ' + mov.placa);
    const corEtapa = mov.cor || '#64748b';
    const icone = mov.icone || 'fa-circle';

    // v3.8: Tempo real desta etapa (entre esta linha e a proxima)
    const tempoEtapa = mov.tempoHoras || 0;
    let tempoHtml = '-';
    if (tempoEtapa > 0) {
      tempoHtml = formatarMinutos(tempoEtapa);
    }

    // v3.8: Se SLA estourado, pinta de vermelho
    const tempoClass = mov.slaEstourado ? 'tempo-estourado' : '';

    html += `<tr>
      <td style="font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
      <td>${formatarDataHora(mov.dt_hora)}</td>
      <td><span class="placa-badge">${mov.placa}</span></td>
      <td style="color: ${corEtapa}; font-weight: 600;"><i class="fas ${icone}" style="margin-right: 6px; font-size: 0.75rem;"></i>${etapa}</td>
      <td>${mov.nome_placa || mov.st_nota}</td>
      <td><span class="proc-badge">${mov.tipo_proc_placa || '-'}</span></td>
      <td>${mov.nome_nota || mov.st_nota}</td>
      <td><span class="proc-badge">${mov.tipo_proc_nota || '-'}</span></td>
      <td style="font-weight: 600; ${mov.slaEstourado ? 'color: var(--danger);' : 'color: var(--text-secondary);'}">${tempoHtml}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;

  // Timeline visual das movimentacoes
  html += `<div style="margin-top: 24px;">
    <div class="timeline-title"><i class="fas fa-stream"></i> Sequencia de Movimentacoes</div>
    <div class="timeline">`;

  timeline.forEach((mov, idx) => {
    const isLiberado = CODIGOS_FIM_SLA.includes(String(mov.st_nota));
    const dotClass = idx === timeline.length - 1 ? 'active' : 'done';

    // v3.8: Tempo real desta etapa
    let tempoEtapa = '';
    if (mov.tempoHoras && mov.tempoHoras > 0) {
      tempoEtapa = `<span style="color: var(--text-muted); margin-left: 8px;">(${formatarMinutos(mov.tempoHoras)} de etapa)</span>`;
    }

    html += `<div class="timeline-item">
      <div class="timeline-dot ${isLiberado ? 'done' : dotClass}"></div>
      <div class="timeline-content">
        <h4><i class="fas ${mov.icone || 'fa-circle'}" style="color: ${mov.cor || '#64748b'};"></i> ${mov.etapa}${tempoEtapa}</h4>
        <p>${formatarDataHora(mov.dt_hora)}</p>
        <div class="timeline-meta">
          <span><i class="fas fa-tag"></i> ${mov.nome_placa || mov.st_nota}</span>
          <span><i class="fas fa-file-invoice"></i> ${mov.nome_nota || mov.st_nota}</span>
        </div>
      </div>
    </div>`;
  });

  html += `</div></div>`;

  body.innerHTML = html;
  subModal.classList.add('active');
}

function fecharSubModal() {
  const subModal = document.getElementById('subModalMovs');
  if (subModal) subModal.classList.remove('active');
}

// ============================================================
// EXPORTAR
// ============================================================
function exportarExcel() {
  if (!dadosNotas || dadosNotas.length === 0) {
    mostrarToast('Nenhum dado para exportar', 'error');
    return;
  }
  const headers = ['Numero NF', 'Fornecedor', 'Loja', 'Data Lancamento', 'Etapa Atual', 'Tempo Total', 'Status SLA', 'Pct SLA', 'Movimentacoes'];
  let csv = headers.join(';') + '\n';
  dadosNotas.forEach(d => {
    csv += [
      d.num_nota,
      d.nome_forn,
      d.codi_loja,
      d.dataPrimeiroLog || d.dtha_lanc,
      d.etapaAtual,
      formatarMinutos(d.tempoTotalHoras),
      d.statusSLA,
      d.pctSLA.toFixed(1) + '%',
      d.totalMovimentacoes
    ].join(';') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'N2M_SLA_Relatorio_' + new Date().toISOString().split('T')[0] + '.csv';
  link.click();
  mostrarToast('Relatorio exportado com sucesso!', 'success');
}

// ============================================================
// UTILS - FORMATACAO DE TEMPO
// ============================================================
function formatarMinutos(horas) {
  if (!horas || horas === 0) return '0min';
  const totalMinutos = Math.round(horas * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  if (totalMinutos >= 60) {
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'min';
  }
  return m + 'min';
}

function formatarHoras(horas) {
  if (!horas || horas === 0) return '0h';
  const h = Math.floor(horas);
  const m = Math.floor((horas - h) * 60);
  if (h === 0) return m + 'min';
  if (m === 0) return h + 'h';
  return h + 'h ' + m + 'min';
}

function formatarData(dataStr) {
  if (!dataStr) return '-';
  const parts = dataStr.split(' ')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dataStr;
}

function formatarDataHora(dataStr) {
  if (!dataStr) return '-';
  return dataStr;
}

function formatarDataInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mostrarToast(msg, tipo) {
  const container = document.querySelector('.toast-container') || criarToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast ' + tipo;
  const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const colorMap = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--accent)' };
  toast.innerHTML = `<i class="fas ${iconMap[tipo]} toast-icon" style="color: ${colorMap[tipo]};"></i><span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function criarToastContainer() {
  const div = document.createElement('div');
  div.className = 'toast-container';
  document.body.appendChild(div);
  return div;
}

function mostrarLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}