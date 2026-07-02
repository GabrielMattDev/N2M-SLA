// ============================================================
// N2M SLA - API Server v3.5
// Node.js + Express + MySQL2
// Lógica SLA v3.5 FINAL:
//   - Linha 1 = RM Loja Início (ponto de partida, NÃO conta SLA)
//   - Tempo entre Linha A e Linha B vai para o SETOR da LINHA A
//   - RM Loja Início NÃO acumula tempo no SLA total
//   - Código 19 (Liberado) = fim da contagem, sem SLA
//   - Tempo Total = soma dos tempos acumulados nos setores (exceto RM Loja Início)
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
  '9999':  { etapa: 'RM Loja Início',              limiteSLA: 0,   icone: 'fa-store',       cor: '#06b6d4', ordem: 1,  grupo: 'rm', contaSLA: false },
  '18':    { etapa: 'RM Central',                    limiteSLA: 0.5, icone: 'fa-warehouse',   cor: '#6366f1', ordem: 2,  grupo: 'rm', contaSLA: true },
  '10073': { etapa: 'Comercial Linha Seca',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10074': { etapa: 'Comercial Perecíveis',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10075': { etapa: 'Comercial Bazar',               limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10076': { etapa: 'Comercial Perfumaria',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10077': { etapa: 'Comercial Limpeza',             limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10078': { etapa: 'Comercial Mercearia',           limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10080': { etapa: 'Comercial Perfumaria Uso Pessoal', limiteSLA: 0.5, icone: 'fa-handshake', cor: '#a855f7', ordem: 3, grupo: 'comercial', contaSLA: true },
  '10081': { etapa: 'Comercial Hort',                limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10082': { etapa: 'Cadastro',                      limiteSLA: 0.5, icone: 'fa-id-card',     cor: '#ef4444', ordem: 4,  grupo: 'cadastro', contaSLA: true },
  '10083': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento', contaSLA: false },
  '10084': { etapa: 'Tributário',                    limiteSLA: 0.5, icone: 'fa-calculator',  cor: '#f59e0b', ordem: 4,  grupo: 'tributario', contaSLA: true },
  '10085': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento', contaSLA: false },
  '10086': { etapa: 'Erro RM Loja',                  limiteSLA: 0.5, icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 1, grupo: 'erro', contaSLA: true },
  '10087': { etapa: 'Encerramento',                  limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 5,  grupo: 'encerramento', contaSLA: false },
  '10090': { etapa: 'Comercial Bomboniere',          limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10096': { etapa: 'Comercial Mercearia Doce',      limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3,  grupo: 'comercial', contaSLA: true },
  '10098': { etapa: 'Erro RM Central',               limiteSLA: 0.5, icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 2, grupo: 'erro', contaSLA: true },
  '19':    { etapa: 'Liberado',                      limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 99, grupo: 'liberado', contaSLA: false }
};

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
  'Comercial Mercearia Doce',
  'Cadastro', 'Tributário',
  'Encerramento', 'Erro RM Loja', 'Erro RM Central',
  'Liberado'
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
    WHERE 1=1
  `;
}

// ============================================================
// ENDPOINT: /api/notas - Lista de notas com filtros
// ============================================================
app.get('/api/notas', async (req, res) => {
  try {
    const { dataInicio, dataFim, loja, nota, fornecedor } = req.query;

    let sql = buildBaseSQL();
    const params = [];

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

    sql += ' ORDER BY la.dtha_lanc DESC, hl.dtha_hlan ASC';

    const rows = await query(sql, params);

    const notasAgrupadas = agruparNotas(rows);
    const notasComSLA = calcularSLA(notasAgrupadas);

    res.json({
      success: true,
      total: notasComSLA.length,
      data: notasComSLA
    });

  } catch (error) {
    console.error('Erro /api/notas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ENDPOINT: /api/notas/:codi_lanc - Detalhes de uma nota
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
// CÁLCULO DE SLA - LÓGICA v3.5 FINAL
// ============================================================
// REGRAS:
// 1. Linha 1 = RM Loja Início (ponto de partida)
// 2. Tempo entre Linha A e Linha B vai para o SETOR da LINHA A
// 3. RM Loja Início NÃO acumula tempo no SLA (contaSLA: false)
// 4. Código 19 (Liberado) = fim da contagem, sem SLA
// 5. Tempo Total = soma dos tempos acumulados nos setores que contam SLA
// ============================================================
function calcularSLA(notas) {
  return notas.map(nota => {
    const movs = nota.movimentacoes.sort((a, b) => 
      new Date(a.dt_hora) - new Date(b.dt_hora)
    );

    // Data do primeiro log (hl.dtha_hlan)
    const dataPrimeiroLog = movs.length > 0 ? movs[0].dt_hora : nota.dtha_lanc;

    // === CÁLCULO POR SETOR ACUMULADO v3.5 FINAL ===
    // Regra: tempo entre linha A e linha B vai para o SETOR da LINHA A
    // RM Loja Início NÃO acumula tempo no SLA total
    // Código 19 = Liberado, fim da contagem

    const temposPorSetor = {};     // { "RM Central": 47.17, "Comercial Hort": 4.5, ... }
    const movimentacoesDetalhadas = []; // detalhe de cada transição
    let tempoTotalHoras = 0;
    let isLiberado = false;
    let etapaAtual = 'RM Loja Início';
    let etapaAtualGrupo = 'rm';
    let etapaAtualCodigo = '9999';

    for (let i = 0; i < movs.length; i++) {
      const movAtual = movs[i];
      const codigoAtual = String(movAtual.st_nota);
      const mapeamentoAtual = MAPEAMENTO_SETORES[codigoAtual];
      const setorAtual = mapeamentoAtual ? mapeamentoAtual.etapa : ('Placa ' + movAtual.placa);
      const grupoAtual = mapeamentoAtual ? mapeamentoAtual.grupo : 'outro';
      const contaSLAAtual = mapeamentoAtual ? mapeamentoAtual.contaSLA : true;

      // Se chegou no código 19 (Liberado), marca como liberado e para
      if (codigoAtual === '19') {
        isLiberado = true;
        etapaAtual = 'Liberado';
        etapaAtualGrupo = 'liberado';
        etapaAtualCodigo = '19';

        // Se não é a primeira linha, calcula o tempo da linha anterior até o 19
        // Esse tempo vai para o setor da linha anterior
        if (i > 0) {
          const movAnterior = movs[i - 1];
          const codAnterior = String(movAnterior.st_nota);
          const mapAnterior = MAPEAMENTO_SETORES[codAnterior];
          const setorAnterior = mapAnterior ? mapAnterior.etapa : ('Placa ' + movAnterior.placa);
          const contaSLAAnterior = mapAnterior ? mapAnterior.contaSLA : true;

          const dtInicio = new Date(movAnterior.dt_hora);
          const dtFim = new Date(movAtual.dt_hora);
          const horas = (dtFim - dtInicio) / (1000 * 60 * 60);
          const tempoHoras = Math.max(0, horas);

          // Sempre registra no temposPorSetor para histórico
          if (!temposPorSetor[setorAnterior]) temposPorSetor[setorAnterior] = 0;
          temposPorSetor[setorAnterior] += tempoHoras;

          // Só soma no tempoTotal se o setor conta SLA
          if (contaSLAAnterior) {
            tempoTotalHoras += tempoHoras;
          }

          movimentacoesDetalhadas.push({
            indice: i,
            dt_inicio: movAnterior.dt_hora,
            dt_fim: movAtual.dt_hora,
            tempoHoras: tempoHoras,
            setorOrigem: setorAnterior,
            setorDestino: 'Liberado',
            codigoOrigem: codAnterior,
            codigoDestino: '19',
            isLiberado: true,
            contaSLA: contaSLAAnterior
          });
        }
        break; // Para de contar - nota está liberada
      }

      // Se não é a primeira linha, calcula tempo desde a linha anterior
      // O tempo vai para o setor da LINHA ANTERIOR (linha A)
      if (i > 0) {
        const movAnterior = movs[i - 1];
        const codAnterior = String(movAnterior.st_nota);
        const mapAnterior = MAPEAMENTO_SETORES[codAnterior];
        const setorAnterior = mapAnterior ? mapAnterior.etapa : ('Placa ' + movAnterior.placa);
        const contaSLAAnterior = mapAnterior ? mapAnterior.contaSLA : true;

        const dtInicio = new Date(movAnterior.dt_hora);
        const dtFim = new Date(movAtual.dt_hora);
        const horas = (dtFim - dtInicio) / (1000 * 60 * 60);
        const tempoHoras = Math.max(0, horas);

        // Sempre registra no temposPorSetor para histórico completo
        if (!temposPorSetor[setorAnterior]) temposPorSetor[setorAnterior] = 0;
        temposPorSetor[setorAnterior] += tempoHoras;

        // Só soma no tempoTotal se o setor conta SLA
        if (contaSLAAnterior) {
          tempoTotalHoras += tempoHoras;
        }

        movimentacoesDetalhadas.push({
          indice: i,
          dt_inicio: movAnterior.dt_hora,
          dt_fim: movAtual.dt_hora,
          tempoHoras: tempoHoras,
          setorOrigem: setorAnterior,
          setorDestino: setorAtual,
          codigoOrigem: codAnterior,
          codigoDestino: codigoAtual,
          isLiberado: false,
          contaSLA: contaSLAAnterior
        });
      }

      // Atualiza etapa atual (se não for RM Loja Início)
      if (setorAtual !== 'RM Loja Início') {
        etapaAtual = setorAtual;
        etapaAtualGrupo = grupoAtual;
        etapaAtualCodigo = codigoAtual;
      }
    }

    // Se NÃO está liberado, a última etapa acumula tempo até AGORA
    if (!isLiberado && movs.length > 0) {
      const ultimaMov = movs[movs.length - 1];
      const codUltimo = String(ultimaMov.st_nota);
      const mapUltimo = MAPEAMENTO_SETORES[codUltimo];
      const setorUltimo = mapUltimo ? mapUltimo.etapa : ('Placa ' + ultimaMov.placa);
      const contaSLAUltimo = mapUltimo ? mapUltimo.contaSLA : true;

      // Se a última etapa não é RM Loja Início nem Liberado, acumula tempo até agora
      if (setorUltimo !== 'RM Loja Início' && setorUltimo !== 'Liberado') {
        const dtUltima = new Date(ultimaMov.dt_hora);
        const agora = new Date();
        const horas = (agora - dtUltima) / (1000 * 60 * 60);
        const tempoHoras = Math.max(0, horas);

        if (!temposPorSetor[setorUltimo]) temposPorSetor[setorUltimo] = 0;
        temposPorSetor[setorUltimo] += tempoHoras;

        if (contaSLAUltimo) {
          tempoTotalHoras += tempoHoras;
        }

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
          isLiberado: false,
          contaSLA: contaSLAUltimo
        });
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

    // Timeline para o modal (todas as movimentações)
    const timeline = movs.map((mov, idx) => {
      const codigo = String(mov.st_nota);
      const mapeamento = MAPEAMENTO_SETORES[codigo];
      const isLast = idx === movs.length - 1;

      // Encontra o tempo acumulado deste setor (se houver)
      let tempoDesteSetor = 0;
      const movDetalhe = movimentacoesDetalhadas.find(m => m.indice === idx);
      if (movDetalhe) tempoDesteSetor = movDetalhe.tempoHoras;

      return {
        etapa: mapeamento ? mapeamento.etapa : ('Placa ' + mov.placa),
        etapaEspecifica: mapeamento ? mapeamento.etapa : ('Placa ' + mov.placa),
        grupo: mapeamento ? mapeamento.grupo : 'outro',
        placa: mov.placa,
        st_nota: mov.st_nota,
        dt_hora: mov.dt_hora,
        tempoHoras: tempoDesteSetor,
        limiteSLA: mapeamento ? mapeamento.limiteSLA : 0.5,
        icone: mapeamento ? mapeamento.icone : 'fa-circle',
        cor: mapeamento ? mapeamento.cor : '#64748b',
        isAtual: isLast && !isLiberado,
        isLiberado: codigo === '19',
        nome_placa: mov.nome_placa,
        nome_nota: mov.nome_nota
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
      temposPorSetor,
      movimentacoesDetalhadas,
      timeline,
      totalMovimentacoes: movs.length
    };
  });
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
    console.log('║              N2M SLA - Server v3.5                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  SLA: 30min por etapa | Data: primeiro log              ║');
    console.log('║  Setores: RM Loja Inicio, RM Central, Comercial...      ║');
    console.log('║  Código 19 = Liberado (sem SLA)                         ║');
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