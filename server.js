// ============================================================
// N2M SLA - API Server v3.3
// Node.js + Express + MySQL2
// Ajustes: nomenclatura setores, cálculo SLA por movimentação, 
// tempo total acumulado, formato Xh Ymin
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
  '10098': { etapa: 'Erro RM Central',               limiteSLA: 0.5, icone: 'fa-exclamation-triangle', cor: '#ef4444', ordem: 2, grupo: 'erro' }
};

// Grupos para exibição resumida na tela principal
const GRUPOS_RESUMIDOS = {
  'rm': 'RM',
  'comercial': 'Comercial',
  'cadastro': 'Cadastro',
  'tributario': 'Tributário',
  'encerramento': 'Encerrado',
  'erro': 'Erro'
};

// Ordem das etapas para timeline
const ETAPAS_ORDEM = [
  'RM Loja Início', 'RM Central',
  'Comercial Linha Seca', 'Comercial Perecíveis', 'Comercial Bazar',
  'Comercial Perfumaria', 'Comercial Limpeza', 'Comercial Mercearia',
  'Comercial Perfumaria Uso Pessoal', 'Comercial Hort', 'Comercial Bomboniere',
  'Comercial Mercearia Doce',
  'Cadastro', 'Tributário',
  'Encerramento', 'Erro RM Loja', 'Erro RM Central'
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

function calcularSLA(notas) {
  return notas.map(nota => {
    const movs = nota.movimentacoes.sort((a, b) => 
      new Date(a.dt_hora) - new Date(b.dt_hora)
    );

    // Data do primeiro log (hl.dtha_hlan)
    const dataPrimeiroLog = movs.length > 0 ? movs[0].dt_hora : nota.dtha_lanc;

    // === CÁLCULO DE TEMPO POR MOVIMENTAÇÃO ===
    // Cada movimentação gera um tempo = diferença até a PRÓXIMA movimentação
    // A última movimentação gera tempo = diferença até AGORA

    const temposPorMovimentacao = [];
    let tempoTotalHoras = 0;

    for (let i = 0; i < movs.length; i++) {
      const movAtual = movs[i];
      const dtInicio = new Date(movAtual.dt_hora);

      let dtFim;
      let isUltima = false;

      if (i < movs.length - 1) {
        // Tem próxima movimentação
        dtFim = new Date(movs[i + 1].dt_hora);
      } else {
        // Última movimentação - tempo até agora
        dtFim = new Date();
        isUltima = true;
      }

      const horas = (dtFim - dtInicio) / (1000 * 60 * 60);
      const tempoHoras = Math.max(0, horas);

      const mapeamento = MAPEAMENTO_SETORES[movAtual.st_nota] || MAPEAMENTO_SETORES[movAtual.placa];
      const etapa = mapeamento ? mapeamento.etapa : ('Placa ' + movAtual.placa);
      const grupo = mapeamento ? mapeamento.grupo : 'outro';

      temposPorMovimentacao.push({
        indice: i,
        dt_inicio: movAtual.dt_hora,
        dt_fim: isUltima ? null : movs[i + 1].dt_hora,
        tempoHoras: tempoHoras,
        etapa: etapa,
        etapaEspecifica: etapa, // nome completo da linha comercial
        grupo: grupo,
        placa: movAtual.placa,
        st_nota: movAtual.st_nota,
        nome_placa: movAtual.nome_placa,
        nome_nota: movAtual.nome_nota,
        isUltima: isUltima
      });

      tempoTotalHoras += tempoHoras;
    }

    // Etapa atual = última movimentação
    const ultimaMov = temposPorMovimentacao[temposPorMovimentacao.length - 1];
    const etapaAtual = ultimaMov ? ultimaMov.etapa : 'RM Loja Início';
    const etapaAtualGrupo = ultimaMov ? ultimaMov.grupo : 'rm';

    // Status SLA da etapa atual
    const configEtapa = MAPEAMENTO_SETORES[ultimaMov?.st_nota] || MAPEAMENTO_SETORES[ultimaMov?.placa];
    const limiteSLA = configEtapa ? configEtapa.limiteSLA : 0.5;
    const tempoNaEtapaAtual = ultimaMov ? ultimaMov.tempoHoras : 0;
    const pctSLA = limiteSLA > 0 ? (tempoNaEtapaAtual / limiteSLA) * 100 : 0;

    let statusSLA = 'ok';
    if (pctSLA > 100) statusSLA = 'danger';
    else if (pctSLA > 80) statusSLA = 'warning';

    // Timeline para o modal (todas as movimentações com tempo específico)
    const timeline = temposPorMovimentacao.map((tm, idx) => {
      const mapeamento = MAPEAMENTO_SETORES[tm.st_nota] || MAPEAMENTO_SETORES[tm.placa];
      return {
        etapa: tm.etapa,
        etapaEspecifica: tm.etapaEspecifica,
        grupo: tm.grupo,
        placa: tm.placa,
        st_nota: tm.st_nota,
        dt_hora: tm.dt_inicio,
        dt_fim: tm.dt_fim,
        tempoHoras: tm.tempoHoras,
        limiteSLA: mapeamento ? mapeamento.limiteSLA : 0.5,
        icone: mapeamento ? mapeamento.icone : 'fa-circle',
        cor: mapeamento ? mapeamento.cor : '#64748b',
        isAtual: idx === temposPorMovimentacao.length - 1,
        nome_placa: tm.nome_placa,
        nome_nota: tm.nome_nota
      };
    });

    // Tempos agregados por etapa (para resumo no modal principal)
    const temposEtapa = {};
    temposPorMovimentacao.forEach(tm => {
      if (!temposEtapa[tm.etapa]) temposEtapa[tm.etapa] = 0;
      temposEtapa[tm.etapa] += tm.tempoHoras;
    });

    return {
      ...nota,
      dataPrimeiroLog,
      etapaAtual,
      etapaAtualGrupo,
      tempoTotalHoras,
      tempoNaEtapaAtual,
      limiteSLA,
      pctSLA,
      statusSLA,
      temposEtapa,
      temposPorMovimentacao,
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
    console.log('║              N2M SLA - Server v3.3                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  SLA: 30min por etapa | Data: primeiro log              ║');
    console.log('║  Setores: RM Loja Inicio, RM Central, Comercial...      ║');
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