import { SavingLocation } from '@/enums';
import type { Messages } from './en';

export const pt: Messages = {
  common: {
    cancel: 'Cancelar',
    save: 'Salvar',
    saving: 'Salvando...',
    close: 'Fechar',
    confirm: 'Confirmar',
    delete: 'Excluir',
    deleting: 'Excluindo...',
    edit: 'Editar',
    undo: 'Desfazer',
    name: 'Nome',
    value: 'Valor',
    date: 'Data',
    notes: 'Notas',
    category: 'Categoria',
    expense: 'Despesa',
    income: 'Receita',
    errorGeneric: 'Algo deu errado. Tente novamente.',
    sortBy: (label: string): string => `Ordenar por ${label}`,
    sorted: (order: string): string =>
      order === 'asc' ? 'Ordem crescente' : 'Ordem decrescente',
  },
  menu: {
    title: 'Menu',
    home: 'Início',
    analytics: 'Análises',
    savings: 'Reservas',
    import: 'Importar extrato',
    profile: 'Perfil',
    signOut: 'Sair',
    theme: 'Tema',
    language: 'Idioma',
  },
  header: {
    menuTooltip: 'Menu',
    newTransactionTooltip: 'Nova transação',
    profileAlt: 'Perfil',
  },
  auth: {
    welcome: 'Boas-vindas',
    signIn: 'Entrar',
    signUp: 'Cadastrar',
    loginButton: 'Entrar',
    pleaseWait: 'Aguarde...',
    email: 'E-mail',
    password: 'Senha',
    name: 'Nome',
    noAccount: 'Não tem uma conta?',
    haveAccount: 'Já tem uma conta?',
    invalidEmail: 'Digite um e-mail válido.',
    invalidPassword:
      'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.',
    loginError: 'Não foi possível entrar. Verifique seus dados.',
    registerError: 'Não foi possível criar sua conta.',
  },
  home: {
    total: 'Total',
    expenses: 'Despesas',
    incomes: 'Receitas',
    loadingMore: 'Carregando mais...',
    noData: 'Nenhuma transação encontrada',
  },
  transactions: {
    newTransaction: 'Nova transação',
    repeatsTooltip: 'Repetir transação?',
    repeatsNone: 'Não repete',
    repeatsMonthly: 'Mensal',
    typeTooltip: 'Tipo de transação',
    selectType: 'Selecione o tipo',
    categoryTooltip: 'Categoria',
    selectCategory: 'Selecione uma categoria',
    numberOfInstallments: 'Número de parcelas',
    valueGreaterThanZero: 'O valor deve ser maior que zero.',
    selectCategoryError: 'Selecione uma categoria.',
    invalidInstallments: 'Informe um número de parcelas válido (maior que 1).',
    saveError: 'Não foi possível salvar a transação.',
    deleteError: 'Não foi possível excluir a transação.',
    deleteAriaLabel: 'Excluir transação',
    dayAndRepeat: (day: string, repeats: string): string =>
      `Dia ${day} (${repeats})`,
    paidEarly: 'antecipada',
    payInstallmentsEarly: 'Antecipar parcelas',
  },
  prepayment: {
    title: 'Antecipar parcelas',
    description:
      'Selecione as parcelas que foram antecipadas na fatura. O vencimento será atualizado para o dia do pagamento.',
    paidOn: 'Paga em',
    payEarlyButton: (count: number): string => {
      if (count <= 0) {
        return 'Antecipar parcelas';
      }
      if (count === 1) {
        return 'Antecipar 1 parcela';
      }
      return `Antecipar ${count} parcelas`;
    },
    paidEarlyHeader: 'Antecipadas',
    paidOnDate: (date: string): string => `paga em ${date}`,
    error: 'Não foi possível atualizar estas parcelas.',
  },
  savings: {
    investments: 'Investimentos',
    investmentType: 'Tipo de investimento',
    selectInvestmentType: 'Selecione um tipo de investimento',
    investmentTypeRequired: 'Selecione um tipo de investimento.',
    allInvestmentTypes: 'Todos os tipos de investimento',
    investmentTypes: {
      TESOURO_DIRETO: 'Tesouro Direto',
      CDB: 'CDB',
      LCI_LCA: 'LCI/LCA',
      CREDIT_BONDS: 'Debêntures, CRI e CRA',
      STOCKS: 'Ações',
      REAL_ESTATE_FUNDS: 'Fundos imobiliários (FIIs)',
      ETFS: 'ETFs',
      BDRS: 'BDRs',
      CRYPTO: 'Criptomoedas',
      INVESTMENT_FUNDS: 'Fundos de investimento',
      PRIVATE_PENSION: 'Previdência privada',
      FOREIGN: 'Investimentos no exterior',
      OTHER_INVESTMENT: 'Outros investimentos',
    },
    investmentGroups: {
      fixedIncome: 'Renda fixa',
      variableIncome: 'Renda variável',
      fundsAndPension: 'Fundos e previdência',
      other: 'Outros',
    },
    title: 'Reservas',
    subtitle:
      'Veja onde seu dinheiro está e por quanto tempo ele pode sustentar você.',
    runway: 'Cobertura de emergência',
    months: 'meses',
    runwayNote:
      'Total guardado ÷ média de despesas dos últimos 3 meses completos. Meses sem despesas ficam fora da média.',
    noRunway: 'Adicione despesas para calcular a cobertura.',
    liquidity: 'Liquidez e investimentos',
    liquid: 'Disponível',
    invested: 'Investido',
    other: 'Outros',
    largest: 'Maior saldo por local',
    allocation: 'Distribuição',
    search: 'Buscar por nome',
    sort: 'Ordenar reservas',
    sortAmount: 'Valor · maior primeiro',
    sortName: 'Nome · A–Z',
    sortUpdated: 'Atualização · mais recente',
    all: 'Todos os locais',
    noMatches: 'Nenhuma reserva corresponde aos filtros.',
    location: 'Local',
    unknownUpdated: 'Data de atualização indisponível',
    review: 'Confira este saldo',
    confirmDelete: 'Excluir esta reserva?',
    confirm: 'Confirmar exclusão',
    cancel: 'Cancelar',
    loading: 'Carregando reservas',
    loadError: 'Não foi possível carregar as reservas.',
    expensesError:
      'Não foi possível carregar as despesas para calcular a cobertura.',
    nameRequired: 'Informe um nome.',
    amountInvalid: 'Informe um valor válido em reais, igual ou maior que zero.',
    updated: (distance: string): string => `Atualizado ${distance}`,

    totalSaved: 'Total guardado',
    entries: 'Registros',
    editTitle: 'Editar reserva',
    addTitle: 'Nova reserva',
    amount: 'Valor',
    byLocation: 'Por local',
    savedMoney: 'Reservas',
    empty: 'Nenhuma reserva cadastrada.',
    invalidForm: 'Informe um nome e um valor válido.',
    saveError: 'Não foi possível salvar a reserva.',
    deleteError: 'Não foi possível excluir a reserva.',
    locations: {
      CASH: 'Dinheiro',
      CHECKING_ACCOUNT: 'Conta corrente',
      SAVINGS_ACCOUNT: 'Poupança',
      INVESTMENT: 'Investimentos',
      OTHER: 'Outros',
    },
  },
  profile: {
    title: 'Perfil',
    chooseImage: 'Escolher foto',
    deleteImage: 'Remover foto',
    greeting: (name: string): string => `Olá, ${name} 👋`,
    confirmPassword: 'Confirmar nova senha',
    passwordsMatchError: 'As senhas não coincidem.',
    passwordRequirementsError:
      'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.',
    saveError: 'Não foi possível salvar as alterações.',
    deleteImageError: 'Não foi possível remover a foto de perfil.',
  },
  import: {
    title: 'Importar extrato',
    description:
      'Fatura em PDF do Bradesco ou fatura em PDF/CSV do Nubank. Nada é salvo antes da sua confirmação.',
    statementFile: 'Arquivo da fatura ou extrato',
    pdfPassword: 'Senha do PDF',
    reading: 'Processando...',
    readStatement: 'Carregar extrato',
    importedTransactions: (count: number): string =>
      count === 1 ? '1 transação' : `${count} transações`,
    importSuccess: (
      imported: number,
      skipped: number,
      moved: number
    ): string => {
      const parts: string[] = [
        `${imported} ${imported === 1 ? 'transação importada' : 'transações importadas'}`,
      ];
      if (skipped > 0) {
        parts.push(
          `${skipped} já ${skipped === 1 ? 'salva ignorada' : 'salvas ignoradas'}`
        );
      }
      if (moved > 0) {
        parts.push(
          `${moved} ${moved === 1 ? 'parcela antecipada movida' : 'parcelas antecipadas movidas'}`
        );
      }
      return `${parts.join(', ')}.`;
    },
    newCategory: 'Nova categoria',
    newCategoryName: 'Nome da categoria',
    newCategoryType: 'Tipo da categoria',
    addCategory: 'Criar categoria',
    summary: (
      total: number,
      duplicates: number,
      credits: number,
      suggested: number
    ): string => {
      const totalPart = `${total} ${total === 1 ? 'linha' : 'linhas'}`;
      const dupPart = `${duplicates} já ${duplicates === 1 ? 'salva' : 'salvas'}`;
      const credPart = `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`;
      return `${totalPart} · ${dupPart} · ${credPart} · ${suggested} com sugestão de categoria`;
    },
    totalsMatch:
      'Todas as linhas foram lidas e conferem com o total da fatura.',
    totalsMismatch: (parsed: number, printed: number): string =>
      `As linhas somam ${parsed}, mas a fatura mostra ${printed}. Verifique antes de importar.`,
    hideAlreadySaved: 'Ocultar já salvas',
    selectAll: 'Selecionar todas',
    selectNone: 'Desmarcar todas',
    categoryForSelected: 'Categoria para as despesas selecionadas…',
    importColumn: 'Importar',
    descriptionColumn: 'Descrição',
    statusColumn: 'Status',
    incomeCategoryPlaceholder: 'Categoria de receita…',
    expenseCategoryPlaceholder: 'Categoria de despesa…',
    selectedCount: (selected: number, missingCategory: number): string => {
      const countPart = `${selected} ${selected === 1 ? 'selecionada' : 'selecionadas'}`;
      if (missingCategory > 0) {
        const needPart = `${missingCategory} ainda sem categoria`;
        return `${countPart} · ${needPart}`;
      }
      return countPart;
    },
    importCount: (count: number): string => `Importar ${count}`,
    importing: 'Importando...',
    seeOnHome: 'Ver no Início',
    emptyPreview:
      'Selecione uma fatura ou extrato para visualizar as linhas aqui.',
    importRow: (description: string): string => `Importar ${description}`,
    categoryForRow: (description: string): string =>
      `Categoria de ${description}`,
    sources: {
      BRADESCO_CARD_PDF: 'Fatura do cartão Bradesco (PDF)',
      NUBANK_CARD_PDF: 'Fatura do cartão Nubank (PDF)',
      NUBANK_CARD_CSV: 'Fatura do cartão Nubank (CSV)',
    },
    suggestions: {
      sameMerchantYouSet: 'Mesmo estabelecimento de uma linha anterior',
      exact: (count: number): string =>
        `Usado antes nesta descrição${count > 1 ? ` (${count}×)` : ''}`,
      merchant: (basis: string, count: number): string =>
        `Mesmo estabelecimento de “${basis}”${count > 1 ? ` (${count}×)` : ''}`,
      keyword: (basis: string): string =>
        `Estabelecimento identificado: “${basis}”`,
      similar: (basis: string, count: number): string =>
        `Similar a “${basis}”${count > 1 ? ` (${count}×)` : ''}`,
      purchase: (basis: string): string =>
        `Categoria da compra salva “${basis}”`,
    },
    statuses: {
      alreadyImported: 'Já importada',
      samePurchaseAsLine: (line: number): string =>
        `Mesma compra da linha ${line}`,
      credit: 'Crédito',
      new: 'Nova',
      prepaidAlreadyPaid: (day: string): string => `Já antecipada em ${day}`,
      prepaidMoves: (installment: string, day: string): string =>
        `Antecipada: move ${installment} para ${day}`,
      prepaidMovesLine: (
        installment: string,
        line: number,
        day: string
      ): string =>
        `Antecipada: move ${installment} da linha ${line} para ${day}`,
      prepaidCreates: (installment: string, day: string): string =>
        `Antecipada: cria a compra, ${installment} em ${day}`,
    },
    lineDetails: {
      installmentPaidEarly: (number: number, total: number): string =>
        `Parcela ${number}/${total} · antecipada`,
      installmentCreatesAll: (number: number, total: number): string =>
        `Parcela ${number}/${total} · cria todas as ${total}`,
    },
  },
  analytics: {
    title: 'Análises',
    subtitle: 'Entenda seu fluxo financeiro e planeje seus próximos passos.',
    periods: {
      week: 'Semana',
      month: 'Mês',
      year: 'Ano',
      custom: 'Personalizado',
    },
    previous: 'Período anterior',
    next: 'Próximo período',
    today: 'Hoje',
    from: 'De',
    to: 'Até',
    invalid:
      'Escolha um período válido. O início deve ser anterior ou igual ao término.',
    loading: 'Carregando visão financeira…',
    error: 'Não foi possível carregar os dados. Tente novamente.',
    empty: 'Nenhuma movimentação neste período.',
    figures: {
      income: 'Receitas',
      expenses: 'Despesas',
      net: 'Resultado',
      savingsRate: 'Taxa de poupança',
      dailyAverage: 'Média de gastos / dia',
    },
    comparison: 'em relação ao período anterior',
    noBaseline: 'Sem período anterior para comparar',
    periodNote:
      'Os valores incluem lançamentos previstos no período selecionado. A média diária considera os dias transcorridos nos períodos que incluem a data de hoje. As comparações utilizam a mesma quantidade de dias do período anterior.',
    budget: 'Margem para gastos',
    budgetNote:
      'Visão do mês civil, independente do período selecionado. Os compromissos incluem parcelas e despesas recorrentes. A data de vencimento é considerada como data de gasto.',
    thisMonth: 'Este mês',
    nextMonth: 'Próximo mês',
    expected: 'Receita prevista',
    estimate: 'Estimativa · média dos últimos 3 meses com receita',
    spent: 'Gasto até agora',
    committed: 'A vencer',
    nextCommitted: 'Despesas comprometidas',
    left: 'Disponível após compromissos',
    free: 'Livre para gastar',
    daily: 'Por dia restante',
    nextDaily: 'Por dia',
    remaining: 'Dias restantes a partir de amanhã',
    spentShare: 'Receita gasta',
    dailyChart: 'Ritmo de gastos',
    dailyNote:
      'Barras diárias para períodos curtos; períodos mais longos exibem a média diária de gastos por semana ou mês. O disponível por dia é a receita do período dividida pelos dias do calendário.',
    allowance: 'Disponível por dia',
    dailySpending: 'Gasto / dia',
    flowChart: 'Receitas vs. despesas',
    cumulativeChart: 'Evolução acumulada: gastos vs. receitas',
    categories: 'Gastos por categoria',
    merchants: 'Principais estabelecimentos',
    unknownMerchant: 'Sem estabelecimento',
    unknownCategory: 'Sem categoria',
    installments: 'Próximos 6 meses já comprometidos',
    installmentNote:
      'Apenas parcelas, agrupadas por categoria. Parcelas antecipadas seguem a nova data de vencimento.',
    savings: 'Reservas por local',
    totalSaved: 'Total guardado',
    locations: {
      [SavingLocation.CASH]: 'Dinheiro',
      [SavingLocation.CHECKING_ACCOUNT]: 'Conta corrente',
      [SavingLocation.SAVINGS_ACCOUNT]: 'Poupança',
      [SavingLocation.INVESTMENT]: 'Investimentos',
      [SavingLocation.OTHER]: 'Outros',
    },
  },
};
