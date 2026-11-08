import prisma from "../config/prisma.js";

const include = { criadoPor: { select: { id: true, nomeUsuario: true } } };

export const relatoriosGeradosRepository = {
  findClients(ids) {
    return prisma.cliente.findMany({
      where: { id: { in: ids } },
      select: { id: true, projetos: { select: { id: true }, take: 51 } },
    });
  },
  countProjects(ids) {
    return prisma.projeto.count({ where: { id: { in: ids } } });
  },
  // Os projetos de `conteudo.projetos` são registrados pelo banco (relatorios_projetos).
  create(data) {
    return prisma.relatorioGerado.create({ data, include });
  },
  findById(id) {
    return prisma.relatorioGerado.findUnique({ where: { id }, include });
  },
  /** Página do histórico, do mais recente para o mais antigo, com os downloads de cada um. */
  async list({ pagina, porPagina, autorId, projetoId, geradoDe, geradoAte }) {
    const dia = 24 * 60 * 60 * 1000;
    const where = {
      ...(autorId ? { criadoPorId: autorId } : {}),
      ...(projetoId ? { projetos: { some: { projetoId } } } : {}),
      ...(geradoDe || geradoAte
        ? {
            createdAt: {
              ...(geradoDe ? { gte: geradoDe } : {}),
              // A data final vale o dia inteiro.
              ...(geradoAte ? { lt: new Date(geradoAte.getTime() + dia) } : {}),
            },
          }
        : {}),
    };
    const [total, registros] = await Promise.all([
      prisma.relatorioGerado.count({ where }),
      prisma.relatorioGerado.findMany({
        where,
        include,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
    ]);
    const exportacoes = registros.length
      ? await prisma.relatorioExportacao.groupBy({
          by: ["relatorioId", "formato"],
          where: { relatorioId: { in: registros.map((registro) => registro.id) } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : [];
    return { total, registros, exportacoes };
  },
  registrarExportacao({ relatorioId, formato, usuarioId }) {
    return prisma.relatorioExportacao.create({ data: { relatorioId, formato, usuarioId } });
  },
};
