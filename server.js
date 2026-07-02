// ============================================================
// N2M SLA - API Server v3.2
// Node.js + Express + MySQL2
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { query, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;  // Mudado de 3000 para 3001

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MAPEAMENTO DE ETAPAS (placa -> setor/etapa)
// ============================================================
const MAPEAMENTO_ETAPAS = {
  '9999': { etapa: 'RM Loja',    limiteSLA: 0.5, icone: 'fa-store',       cor: '#06b6d4', ordem: 1 },
  '18':   { etapa: 'RM CD',      limiteSLA: 0.5, icone: 'fa-warehouse',   cor: '#6366f1', ordem: 2 },
  '10081':{ etapa: 'Comercial',  limiteSLA: 0.5, icone: 'fa-handshake',   cor: '#a855f7', ordem: 3 },
  '10084':{ etapa: 'Fiscal',     limiteSLA: 0.5, icone: 'fa-calculator',  cor: '#f59e0b', ordem: 4 },
  '10082':{ etapa: 'Cadastro',   limiteSLA: 0.5, icone: 'fa-id-card',     cor: '#ef4444', ordem: 5 },
  '10083':{ etapa: 'Liberado',   limiteSLA: 0,   icone: 'fa-check-circle',cor: '#10b981', ordem: 6 }
};

const ETAPAS_ORDEM = ['RM Loja', 'RM CD', 'Comercial', 'Fiscal', 'Cadastro', 'Liberado'];

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

    const temposEtapa = {};
    let etapaAtual = 'RM Loja';
    let tempoTotalHoras = 0;

    const etapasProcessadas = [];

    for (let i = 0; i < movs.length; i++) {
      const mov = movs[i];
      const mapeamento = MAPEAMENTO_ETAPAS[mov.placa];

      if (mapeamento) {
        etapasProcessadas.push({
          etapa: mapeamento.etapa,
          dt_hora: mov.dt_hora,
          placa: mov.placa,
          limiteSLA: mapeamento.limiteSLA,
          ordem: mapeamento.ordem
        });
      }
    }

    // Calcular tempo em cada etapa (entre movimentacoes consecutivas)
    for (let i = 0; i < etapasProcessadas.length - 1; i++) {
      const atual = etapasProcessadas[i];
      const proxima = etapasProcessadas[i + 1];

      const dtInicio = new Date(atual.dt_hora);
      const dtFim = new Date(proxima.dt_hora);
      const horas = (dtFim - dtInicio) / (1000 * 60 * 60);

      temposEtapa[atual.etapa] = Math.max(0, horas);
      tempoTotalHoras += temposEtapa[atual.etapa];
    }

    // Tempo desde ultima etapa ate agora
    if (etapasProcessadas.length > 0) {
      const ultima = etapasProcessadas[etapasProcessadas.length - 1];
      const dtUltima = new Date(ultima.dt_hora);
      const agora = new Date();
      const horasDesdeUltima = (agora - dtUltima) / (1000 * 60 * 60);

      temposEtapa[ultima.etapa] = Math.max(0, horasDesdeUltima);
      tempoTotalHoras += temposEtapa[ultima.etapa];
      etapaAtual = ultima.etapa;
    }

    // Status SLA com limite de 30min (0.5h) por etapa
    const configEtapa = Object.values(MAPEAMENTO_ETAPAS).find(e => e.etapa === etapaAtual);
    const limiteSLA = configEtapa ? configEtapa.limiteSLA : 0.5;
    const tempoNaEtapa = temposEtapa[etapaAtual] || 0;
    const pctSLA = limiteSLA > 0 ? (tempoNaEtapa / limiteSLA) * 100 : 0;

    let statusSLA = 'ok';
    if (pctSLA > 100) statusSLA = 'danger';
    else if (pctSLA > 80) statusSLA = 'warning';

    // Timeline
    const timeline = etapasProcessadas.map((ep, idx) => {
      const isLast = idx === etapasProcessadas.length - 1;
      const tempo = temposEtapa[ep.etapa] || 0;
      const config = MAPEAMENTO_ETAPAS[ep.placa];

      return {
        etapa: ep.etapa,
        placa: ep.placa,
        dt_hora: ep.dt_hora,
        tempoHoras: tempo,
        limiteSLA: ep.limiteSLA,
        icone: config ? config.icone : 'fa-circle',
        cor: config ? config.cor : '#64748b',
        isAtual: isLast
      };
    });

    return {
      ...nota,
      dataPrimeiroLog,
      etapaAtual,
      tempoTotalHoras,
      tempoNaEtapaAtual: temposEtapa[etapaAtual] || 0,
      limiteSLA,
      pctSLA,
      statusSLA,
      temposEtapa,
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
    console.log('║              N2M SLA - Server v3.2                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  SLA: 30min por etapa | Data: primeiro log              ║');
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
