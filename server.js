// ============================================================
// N2M SLA - API Server v3.8
// Node.js + Express + MySQL2
// Lógica SLA v3.8:
//   - Tempo entre Linha A e Linha B vai para o SETOR da LINHA A
//   - Todos os setores contam SLA (inclusive RM Loja Início, mas tempo = 0)
//   - Código 19 e 20 (Liberado/Coletada) = fim da contagem, sem SLA
//   - Tempo Total = soma de TODOS os tempos acumulados
//   - Ordenação padrão: maior SLA primeiro
//   - Filtro: Pendente / Liberado / Todos
//   - Alerta vermelho para notas com tempo total > 2 horas
//   - Exclui fornecedores que começam com MULTICOM
//   - Timeline: "Tempo de Etapa" mostra tempo real entre linha e próxima
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { query, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MAPEAMENTO COMPLETO DE SETORES (stus_nota / stus_plca)
// ============================================================
const MAPEAMENTO_SETORES = {
  '9999':  { etapa: 'RM Loja Início',              limiteSLA: 0.5, icone: 'fa-store',       cor: '#06b6d4', ordem: 1,  grupo: 'rm' },
  '18':    { etapa: 'RM Central',                    limiteSLA: 0.5, icone: 'fa-warehouse',   cor: '#6366f1', ordem: 2,  grupo: 'rm' },
  '10073': { etapa: 'Comercial Linha Seca',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10074': { etapa: 'Comercial Perecíveis',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10075': { etapa: 'Comercial Bazar',               limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10076': { etapa: 'Comercial Perfumaria',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10077': { etapa: 'Comercial Limpeza',             limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10078': { etapa: 'Comercial Mercearia',           limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10080': { etapa: 'Comercial Perfumaria Uso Pessoal', limiteSLA: 0.5, icone: 'fa-handshake', cor: '#a855f7', ordem: 3, grupo: 'comercial' },
  '10081': { etapa: 'Comercial Hort',                limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10082': { etapa: 'Cadastro',                      limiteSLA: 0.5, icone: 'fa-id-card',     cor: '#ef4444', ordem: 4,  grupo: 'cadastro' },
  '10083': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10084': { etapa: 'Tributário',                    limiteSLA: 0.5, icone: 'fa-calculator',  cor: '#f59e0b', ordem: 4,  grupo: 'tributario' },
  '10085': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10086': { etapa: 'Erro RM Loja',                  limiteSLA: 0.5, icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 1, grupo: 'erro' },
  '10087': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento' },
  '10090': { etapa: 'Comercial Bomboniere',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10096': { etapa: 'Comercial Mercearia Doce',      limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '10098': { etapa: 'Erro RM Central',               limiteSLA: 0.5, icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 2, grupo: 'erro' },
  '10099': { etapa: 'Comercial Bazar com Limpeza',   limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial' },
  '12':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '13':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '14':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '15':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '21':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '25':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '30':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '31':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '32':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '37':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '39':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '43':    { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10030': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10038': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10060': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10061': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10063': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10072': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10085': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '10087': { etapa: 'Finalizado',                    limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '19':    { etapa: 'Liberado',                      limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' },
  '20':    { etapa: 'Coletada',                      limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado' }
};

// Códigos que representam fim do SLA (liberado/coletada)
const CODIGOS_FIM_SLA = ['19', '20', '12', '13', '14', '15', '21', '25', '30', '31', '32', '37', '39', '43', '10030', '10038', '10060', '10061', '10063', '10072', '10085', '10087'];

// Grupos para exibição resumida na tela principal
const GRUPOS_RESUMIDOS = {
  'rm': 'RM',
  'comercial': 'Comercial',
  'cadastro': 'Cadastro',
  'tributario': 'Tributário',
  'encerramento': 'Encerrado',
  'erro': 'Erro',
  'liberado': 'Liberado'
};

// Ordem das etapas para timeline
const ETAPAS_ORDEM = [
  'RM Loja Início', 'RM Central',
  'Comercial Linha Seca', 'Comercial Perecíveis', 'Comercial Bazar',
  'Comercial Perfumaria', 'Comercial Limpeza', 'Comercial Mercearia',
  'Comercial Perfumaria Uso Pessoal', 'Comercial Hort', 'Comercial Bomboniere',
  'Comercial Mercearia Doce','Comercial Bazar com Limpeza',
  'Cadastro', 'Tributário',
  'Encerramento', 'Erro RM Loja', 'Erro RM Central',
  'Liberado', 'Coletada'
];

// ============================================================
// SQL BASE
// ============================================================
function buildBaseSQL() {
  return `
    SELECT 
      la.codi_lanc,
      la.codi_loja,
      la.codi_forn,
      fn.nome_forn,
      la.codi_user,
      la.dtha_lanc,
      la.dtha_alte,
      la.codi_stus,
      st.nome_stus AS status_geral,
      lj.nome_loja,

      hl.dtha_hlan AS dt_hora,
      hl.plca_lanc AS placa,
      hl.stus_plca AS st_placa,
      stp.nome_stus AS nome_placa,
      stp.tipo_proc AS tipo_proc_placa,
      hl.nume_ntfs AS num_nota,
      hl.stus_nota AS st_nota,
      stn.nome_stus AS nome_nota,
      stn.tipo_proc AS tipo_proc_nota

    FROM cad_lanc_tb la
    JOIN cad_forn_tb fn ON (fn.codi_forn = la.codi_forn)
    JOIN cad_stus_tb st ON (st.codi_stus = la.codi_stus)
    JOIN cad_hlan_tb hl ON (hl.codi_lanc = la.codi_lanc)
    JOIN cad_stus_tb stp ON (stp.codi_stus = hl.stus_plca)
    JOIN cad_stus_tb stn ON (stn.codi_stus = hl.stus_nota)
    LEFT JOIN cad_loja_tb lj ON (lj.codi_loja = la.codi_loja)
    WHERE 1=1
  `;
}

// ============================================================
// ENDPOINT: /api/notas - Lista de notas com filtros
// ============================================================
app.get('/api/notas', async (req, res) => {
  try {
    const { dataInicio, dataFim, loja, nota, fornecedor, status, setor } = req.query;

    let sql = buildBaseSQL();
    const params = [];

    // Filtro: excluir fornecedores que começam com MULTICOM
    sql += " AND fn.nome_forn NOT LIKE 'MULTICOM%'";

    if (dataInicio) {
      sql += ' AND DATE(la.dtha_lanc) >= ?';
      params.push(dataInicio);
    }
    if (dataFim) {
      sql += ' AND DATE(la.dtha_lanc) <= ?';
      params.push(dataFim);
    }
    if (loja && loja !== 'Todas') {
      sql += ' AND la.codi_loja = ?';
      params.push(loja);
    }
    if (nota && nota !== '') {
      sql += ' AND hl.nume_ntfs = ?';
      params.push(nota);
    }
    if (fornecedor && fornecedor !== '') {
      sql += ' AND fn.nome_forn LIKE ?';
      params.push('%' + fornecedor + '%');
    }
    // Ordenação SQL: por data do lançamento (depois reordenamos no JS por SLA)
    sql += ' ORDER BY la.dtha_lanc DESC, hl.dtha_hlan ASC';

    const rows = await query(sql, params);

    const notasAgrupadas = agruparNotas(rows);
    const notasComSLA = calcularSLA(notasAgrupadas);

    // v3.8.3 FIX: Consolidar notas duplicadas (mesmo num_nota com codi_lanc diferentes)
    // Mantém apenas a nota com MAIOR progresso (liberada > pendente)
    const notasConsolidadas = consolidarNotasDuplicadas(notasComSLA);

    // Aplicar filtro de status (Pendente / Liberado / Todos)
    let notasFiltradas = notasConsolidadas;
    if (status === 'pendente') {
      notasFiltradas = notasComSLA.filter(n => !n.isLiberado);
    } else if (status === 'liberado') {
      notasFiltradas = notasComSLA.filter(n => n.isLiberado);
    }
    // status === 'todos' ou undefined = não filtra

    // v3.8.5 FIX: Filtro de setor pela ETAPA ATUAL (última movimentação)
    // Se status = 'liberado', o filtro de setor NÃO é aplicado (mostra todas liberadas)
    // Se status = 'pendente' ou 'todos', compara etapaAtualCodigo com o setor filtrado
    if (setor && setor !== 'todos') {
      notasFiltradas = notasFiltradas.filter(n => {
        // Se o usuário filtrou por 'Liberado', não aplica filtro de setor
        // (mostra todas as notas liberadas, independente do setor histórico)
        if (status === 'liberado') return true;
        // Para 'pendente' ou 'todos': notas liberadas não têm setor específico
        // (etapa atual é sempre 'Liberado'/'Coletada'), então são ignoradas
        if (n.isLiberado) return false;
        // Compara o código da etapa atual com o setor filtrado
        return String(n.etapaAtualCodigo) === String(setor);
      });
    }

    // Ordenação padrão: notas com maior SLA primeiro
    // Prioridade: não liberados com maior pctSLA, depois liberados
    notasFiltradas.sort((a, b) => {
      // Se um está liberado e outro não, o não liberado vem primeiro
      if (a.isLiberado && !b.isLiberado) return 1;
      if (!a.isLiberado && b.isLiberado) return -1;

      // Ambos liberados ou ambos não liberados: ordena por pctSLA decrescente
      // Para liberados, pctSLA é 0, então ordena por tempoTotalHoras decrescente
      if (a.isLiberado && b.isLiberado) {
        return b.tempoTotalHoras - a.tempoTotalHoras;
      }

      // Não liberados: maior pctSLA primeiro
      return b.pctSLA - a.pctSLA;
    });

    res.json({
      success: true,
      total: notasFiltradas.length,
      data: notasFiltradas
    });

  } catch (error) {
    console.error('Erro /api/notas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ENDPOINT: /api/notas/:codi_lanc - Detalhes de uma nota por codi_lanc
// v3.8.4 FIX: Retorna o lançamento específico SEM consolidar
// ============================================================
app.get('/api/notas/:codi_lanc', async (req, res) => {
  try {
    const { codi_lanc } = req.params;

    let sql = buildBaseSQL();
    sql += ' AND la.codi_lanc = ? ORDER BY hl.dtha_hlan ASC';

    const rows = await query(sql, [codi_lanc]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nota nao encontrada' });
    }

    const notaAgrupada = agruparNotas(rows);
    const notaComSLA = calcularSLA(notaAgrupada);

    // v3.8.4 FIX: Retorna direto o lançamento específico do codi_lanc
    // NÃO chama consolidarNotasDuplicadas() — isso causava troca de fornecedor/loja
    res.json({
      success: true,
      data: notaComSLA[0]
    });

  } catch (error) {
    console.error('Erro /api/notas/:codi_lanc:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ENDPOINT: /api/notas/nf/:num_nota - Detalhes de uma nota por NF
// v3.8.3: Busca por número da nota fiscal (evita conflito de codi_lanc)
// ============================================================
app.get('/api/notas/nf/:num_nota', async (req, res) => {
  try {
    const { num_nota } = req.params;

    let sql = buildBaseSQL();
    sql += ' AND hl.nume_ntfs = ? ORDER BY hl.dtha_hlan ASC';

    const rows = await query(sql, [num_nota]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nota nao encontrada' });
    }

    const notaAgrupada = agruparNotas(rows);
    const notaComSLA = calcularSLA(notaAgrupada);

    // v3.8.3 FIX: Consolidar se houver múltiplos codi_lanc para a mesma NF
    const notasConsolidadas = consolidarNotasDuplicadas(notaComSLA);

    res.json({
      success: true,
      data: notasConsolidadas[0]
    });

  } catch (error) {
    console.error('Erro /api/notas/nf/:num_nota:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ENDPOINT: /api/lojas - Lista de lojas
// ============================================================
app.get('/api/lojas', async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT 
        la.codi_loja,
        lj.nome_loja
      FROM cad_lanc_tb la
      LEFT JOIN cad_loja_tb lj ON (lj.codi_loja = la.codi_loja)
      ORDER BY lj.nome_loja
    `;
    const rows = await query(sql);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro /api/lojas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// FUNCOES AUXILIARES
// ============================================================

function agruparNotas(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = row.codi_lanc + '_' + row.num_nota;

    if (!map.has(key)) {
      map.set(key, {
        codi_lanc: row.codi_lanc,
        codi_loja: row.codi_loja,
        nome_loja: row.nome_loja,
        codi_forn: row.codi_forn,
        nome_forn: row.nome_forn,
        num_nota: row.num_nota,
        status_geral: row.status_geral,
        dtha_lanc: row.dtha_lanc,
        movimentacoes: []
      });
    }

    const nota = map.get(key);
    nota.movimentacoes.push({
      dt_hora: row.dt_hora,
      placa: String(row.placa),
      st_placa: row.st_placa,
      nome_placa: row.nome_placa,
      tipo_proc_placa: row.tipo_proc_placa,
      st_nota: row.st_nota,
      nome_nota: row.nome_nota,
      tipo_proc_nota: row.tipo_proc_nota
    });
  }

  return Array.from(map.values());
}

// ============================================================
// CÁLCULO DE SLA - LÓGICA v3.8 FINAL
// ============================================================
// REGRAS:
// 1. Tempo entre Linha A e Linha B vai para o SETOR da LINHA A
// 2. Todos os setores contam SLA (inclusive RM Loja Início, mas tempo = 0)
// 3. Código 19 e 20 (Liberado/Coletada) = fim da contagem, sem SLA
// 4. Tempo Total = soma de TODOS os tempos acumulados
// 5. Alerta vermelho se tempoTotalHoras > 2
// 6. Timeline "Tempo de Etapa": tempo REAL entre esta linha e a próxima
// ============================================================
function calcularSLA(notas) {
  return notas.map(nota => {
    const movs = nota.movimentacoes.sort((a, b) => 
      new Date(a.dt_hora) - new Date(b.dt_hora)
    );

    // Data do primeiro log (hl.dtha_hlan)
    const dataPrimeiroLog = movs.length > 0 ? movs[0].dt_hora : nota.dtha_lanc;

    // === CÁLCULO POR SETOR ACUMULADO v3.8 ===
    const temposPorSetor = {};     // { "RM Loja Início": 0, "RM Central": 84.35, ... }
    const movimentacoesDetalhadas = []; // detalhe de cada transição
    const tempoPorLinha = [];      // v3.8: tempo real de cada linha (para timeline)
    let tempoTotalHoras = 0;
    let isLiberado = false;
    let etapaAtual = 'RM Loja Início';
    let etapaAtualGrupo = 'rm';
    let etapaAtualCodigo = '9999';

    for (let i = 0; i < movs.length; i++) {
      const movAtual = movs[i];
      const codigoAtual = String(movAtual.st_nota || '').trim();
      const mapeamentoAtual = MAPEAMENTO_SETORES[codigoAtual];
      const setorAtual = mapeamentoAtual ? mapeamentoAtual.etapa : (CODIGOS_FIM_SLA.includes(codigoAtual) ? 'Finalizado' : ('Placa ' + movAtual.placa));
      const grupoAtual = mapeamentoAtual ? mapeamentoAtual.grupo : 'outro';

      // Se chegou no código de fim (19 ou 20), marca como liberado e para
      if (CODIGOS_FIM_SLA.includes(codigoAtual)) {
        isLiberado = true;
        etapaAtual = mapeamentoAtual ? mapeamentoAtual.etapa : 'Liberado';
        etapaAtualGrupo = 'liberado';
        etapaAtualCodigo = codigoAtual;

        // Se não é a primeira linha, calcula o tempo da linha anterior até o fim
        // Esse tempo vai para o setor da linha anterior (linha A)
        if (i > 0) {
          const movAnterior = movs[i - 1];
          const codAnterior = String(movAnterior.st_nota || '').trim();
          const mapAnterior = MAPEAMENTO_SETORES[codAnterior];
          const setorAnterior = mapAnterior ? mapAnterior.etapa : ('Placa ' + movAnterior.placa);

          const dtInicio = new Date(movAnterior.dt_hora);
          const dtFim = new Date(movAtual.dt_hora);
          const horas = (dtFim - dtInicio) / (1000 * 60 * 60);
          const tempoHoras = Math.max(0, horas);

          // Acumula no setor da LINHA ANTERIOR (linha A)
          if (!temposPorSetor[setorAnterior]) temposPorSetor[setorAnterior] = 0;
          temposPorSetor[setorAnterior] += tempoHoras;
          tempoTotalHoras += tempoHoras;

          // v3.8: tempo da linha anterior (i-1) é o tempo até esta linha (i)
          tempoPorLinha[i - 1] = tempoHoras;

          movimentacoesDetalhadas.push({
            indice: i,
            dt_inicio: movAnterior.dt_hora,
            dt_fim: movAtual.dt_hora,
            tempoHoras: tempoHoras,
            setorOrigem: setorAnterior,
            setorDestino: setorAtual,
            codigoOrigem: codAnterior,
            codigoDestino: codigoAtual,
            isLiberado: true
          });
        }
        break; // Para de contar - nota está liberada/coletada
      }

      // Se não é a primeira linha, calcula tempo desde a linha anterior
      // O tempo vai para o setor da LINHA ANTERIOR (linha A)
      if (i > 0) {
        const movAnterior = movs[i - 1];
        const codAnterior = String(movAnterior.st_nota || '').trim();
        const mapAnterior = MAPEAMENTO_SETORES[codAnterior];
        const setorAnterior = mapAnterior ? mapAnterior.etapa : ('Placa ' + movAnterior.placa);

        const dtInicio = new Date(movAnterior.dt_hora);
        const dtFim = new Date(movAtual.dt_hora);
        const horas = (dtFim - dtInicio) / (1000 * 60 * 60);
        const tempoHoras = Math.max(0, horas);

        // Acumula no setor da LINHA ANTERIOR (linha A)
        if (!temposPorSetor[setorAnterior]) temposPorSetor[setorAnterior] = 0;
        temposPorSetor[setorAnterior] += tempoHoras;
        tempoTotalHoras += tempoHoras;

        // v3.8: tempo da linha anterior (i-1) é o tempo até esta linha (i)
        tempoPorLinha[i - 1] = tempoHoras;

        movimentacoesDetalhadas.push({
          indice: i,
          dt_inicio: movAnterior.dt_hora,
          dt_fim: movAtual.dt_hora,
          tempoHoras: tempoHoras,
          setorOrigem: setorAnterior,
          setorDestino: setorAtual,
          codigoOrigem: codAnterior,
          codigoDestino: codigoAtual,
          isLiberado: false
        });
      }

      // Atualiza etapa atual (se não for RM Loja Início e NÃO for código de fim)
      if (setorAtual !== 'RM Loja Início' && !CODIGOS_FIM_SLA.includes(codigoAtual)) {
        etapaAtual = setorAtual;
        etapaAtualGrupo = grupoAtual;
        etapaAtualCodigo = codigoAtual;
      }
    }

    // Se NÃO está liberado, a última etapa acumula tempo até AGORA
    if (!isLiberado && movs.length > 0) {
      const ultimaMov = movs[movs.length - 1];
      const codUltimo = String(ultimaMov.st_nota || '').trim();
      const mapUltimo = MAPEAMENTO_SETORES[codUltimo];
      const setorUltimo = mapUltimo ? mapUltimo.etapa : ('Placa ' + ultimaMov.placa);

      // Se a última etapa não é fim, acumula tempo até agora
      if (!CODIGOS_FIM_SLA.includes(codUltimo)) {
        const dtUltima = new Date(ultimaMov.dt_hora);
        const agora = new Date();
        const horas = (agora - dtUltima) / (1000 * 60 * 60);
        const tempoHoras = Math.max(0, horas);

        if (!temposPorSetor[setorUltimo]) temposPorSetor[setorUltimo] = 0;
        temposPorSetor[setorUltimo] += tempoHoras;
        tempoTotalHoras += tempoHoras;

        // v3.8: tempo da última linha
        tempoPorLinha[movs.length - 1] = tempoHoras;

        movimentacoesDetalhadas.push({
          indice: movs.length,
          dt_inicio: ultimaMov.dt_hora,
          dt_fim: null, // até agora
          tempoHoras: tempoHoras,
          setorOrigem: setorUltimo,
          setorDestino: setorUltimo,
          codigoOrigem: codUltimo,
          codigoDestino: codUltimo,
          isAtual: true,
          isLiberado: false
        });
      }
    }

    // v3.8 FIX: Verificação final - se existe código 19/20 em qualquer movimentação, forçar liberado
    // Isso garante que notas com código de fim sejam sempre marcadas como liberadas
    const temCodigoFim = movs.some(m => CODIGOS_FIM_SLA.includes(String(m.st_nota || '').trim()));
    // DEBUG: log para verificar códigos detectados
    const codigosDetectados = movs.map(m => String(m.st_nota || '').trim()).filter(c => CODIGOS_FIM_SLA.includes(c));
    if (codigosDetectados.length > 0) {
      console.log(`[DEBUG] Nota ${nota.num_nota} - Códigos de fim detectados:`, codigosDetectados);
    }
    if (temCodigoFim) {
      isLiberado = true;
      etapaAtual = 'Liberado';
      etapaAtualGrupo = 'liberado';
      // Encontra o último código de fim para etapaAtualCodigo
      for (let j = movs.length - 1; j >= 0; j--) {
        const cod = String(movs[j].st_nota || '').trim();
        if (CODIGOS_FIM_SLA.includes(cod)) {
          etapaAtualCodigo = cod;
          break;
        }
      }
    }

    // Status SLA da etapa atual
    const configEtapa = MAPEAMENTO_SETORES[etapaAtualCodigo];
    const limiteSLA = configEtapa ? configEtapa.limiteSLA : 0.5;
    const tempoNaEtapaAtual = temposPorSetor[etapaAtual] || 0;
    const pctSLA = (limiteSLA > 0 && !isLiberado) ? (tempoNaEtapaAtual / limiteSLA) * 100 : 0;

    let statusSLA = 'ok';
    if (isLiberado) statusSLA = 'liberado';
    else if (pctSLA > 100) statusSLA = 'danger';
    else if (pctSLA > 80) statusSLA = 'warning';

    // Alerta vermelho: tempo total > 2 horas
    const alertaVermelho = tempoTotalHoras > 2;

    // Timeline para o modal (todas as movimentações)
    // v3.8: "Tempo de Etapa" = tempo REAL entre esta linha e a próxima
    const timeline = movs.map((mov, idx) => {
      const codigo = String(mov.st_nota);
      const mapeamento = MAPEAMENTO_SETORES[codigo];
      const isLast = idx === movs.length - 1;

      // v3.8: O tempo desta linha é o tempo desde ESTA linha até a PRÓXIMA
      // tempoPorLinha[idx] contém o tempo calculado no loop acima
      let tempoDestaLinha = tempoPorLinha[idx] || 0;
      let slaEstourado = false;

      // Verifica se o tempo desta etapa estourou o SLA de 30 min (0.5h)
      const limite = mapeamento ? mapeamento.limiteSLA : 0.5;
      if (limite > 0 && tempoDestaLinha > limite) {
        slaEstourado = true;
      }

      return {
        etapa: mapeamento ? mapeamento.etapa : ('Placa ' + mov.placa),
        etapaEspecifica: mapeamento ? mapeamento.etapa : ('Placa ' + mov.placa),
        grupo: mapeamento ? mapeamento.grupo : 'outro',
        placa: mov.placa,
        st_nota: mov.st_nota,
        dt_hora: mov.dt_hora,
        tempoHoras: tempoDestaLinha,  // v3.8: tempo real desta linha até a próxima
        limiteSLA: mapeamento ? mapeamento.limiteSLA : 0.5,
        icone: mapeamento ? mapeamento.icone : 'fa-circle',
        cor: mapeamento ? mapeamento.cor : '#64748b',
        isAtual: isLast && !isLiberado,
        isLiberado: CODIGOS_FIM_SLA.includes(codigo),
        nome_placa: mov.nome_placa,
        nome_nota: mov.nome_nota,
        slaEstourado: slaEstourado  // v3.8: indica se esta etapa estourou SLA
      };
    });

    return {
      ...nota,
      dataPrimeiroLog,
      etapaAtual,
      etapaAtualGrupo,
      etapaAtualCodigo,
      tempoTotalHoras,
      tempoNaEtapaAtual,
      limiteSLA,
      pctSLA,
      statusSLA,
      isLiberado,
      alertaVermelho,  // v3.8: true se tempoTotalHoras > 2
      temposPorSetor,
      movimentacoesDetalhadas,
      timeline,
      totalMovimentacoes: movs.length
    };
  });
}

// ============================================================
// FUNÇÃO: Consolidar notas duplicadas (mesmo num_nota, codi_lanc diferentes)
// v3.8.3: Se uma NF tem múltiplos codi_lanc, mantém apenas a mais completa
// ============================================================
function consolidarNotasDuplicadas(notas) {
  const map = new Map();

  for (const nota of notas) {
    const numNF = nota.num_nota;

    if (!map.has(numNF)) {
      // Primeira ocorrência desta NF
      map.set(numNF, nota);
    } else {
      const existente = map.get(numNF);

      // Se a nova nota está liberada e a existente não, substitui
      if (nota.isLiberado && !existente.isLiberado) {
        map.set(numNF, nota);
      }
      // Se ambas estão liberadas, mantém a que tem mais movimentações
      else if (nota.isLiberado && existente.isLiberado) {
        if (nota.totalMovimentacoes > existente.totalMovimentacoes) {
          map.set(numNF, nota);
        }
      }
      // Se nenhuma está liberada, mantém a que tem mais movimentações
      // (mais completa/progressiva)
      else if (!nota.isLiberado && !existente.isLiberado) {
        if (nota.totalMovimentacoes > existente.totalMovimentacoes) {
          map.set(numNF, nota);
        }
      }
      // Se a existente está liberada e a nova não, mantém a existente
    }
  }

  return Array.from(map.values());
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
async function start() {
  const connected = await testConnection();
  if (!connected) {
    console.warn('⚠️  MySQL nao conectado. O servidor iniciara mesmo assim.');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              N2M SLA - Server v3.8                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  SLA: 30min por etapa | Data: primeiro log              ║');
    console.log('║  Setores: RM Loja Inicio, RM Central, Comercial...      ║');
    console.log('║  Código 19/20 = Liberado/Coletada (sem SLA)             ║');
    console.log('║  Ordenação: Maior SLA primeiro                          ║');
    console.log('║  Filtro: Pendente / Liberado / Todos                    ║');
    console.log('║  Alerta: Vermelho se tempo total > 2h                   ║');
    console.log('║  Exclui: Fornecedores MULTICOM                          ║');
    console.log('║  API: http://localhost:' + PORT + '/api                     ║');
    console.log('║  Relatorio: http://localhost:' + PORT + '                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('❌ Porta ' + PORT + ' ja esta em uso!');
      console.error('   Tente: set PORT=3002 && npm start');
      process.exit(1);
    } else {
      console.error('❌ Erro ao iniciar servidor:', err);
      process.exit(1);
    }
  });
}

start();