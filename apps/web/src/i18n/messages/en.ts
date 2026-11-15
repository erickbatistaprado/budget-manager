import { SavingLocation } from '@/enums';

export const en = {
  cards: {
    applyBillDates: 'Apply bill date to saved purchases',
    reimportHint:
      'Saved purchases without a bill date will also move to this bill month.',

    title: 'Cards',
    add: 'Add card',
    closingDay: 'Closing day',
    dueDay: 'Due day',
    paidWith: 'Paid with',
    noCard: 'No card (Pix, debit, cash)',
    card: 'Card',
    billDueDate: 'Bill due date',
    validation: 'Enter a name and whole days between 1 and 31.',
    deleteConfirmation: (name: string): string =>
      `Delete ${name}? Purchases keep their bill dates.`,
    schedule: (closing: number, due: number): string =>
      `Closes on day ${closing}, due on day ${due}`,
    billDue: (date: string): string => `Bill due ${date}`,
    billMonth: (month: string): string => `Bill ${month}`,
    moved: (count: number): string => `moved ${count} to their bill month`,
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    deleting: 'Deleting...',
    edit: 'Edit',
    undo: 'Undo',
    name: 'Name',
    value: 'Value',
    date: 'Date',
    notes: 'Notes',
    category: 'Category',
    expense: 'Expense',
    income: 'Income',
    errorGeneric: 'Something went wrong. Try again.',
    sortBy: (label: string): string => `Sort by ${label}`,
    sorted: (order: string): string => `Sorted ${order}`,
  },
  menu: {
    title: 'Menu',
    home: 'Home',
    analytics: 'Analytics',
    savings: 'Savings',
    import: 'Import',
    profile: 'Profile',
    signOut: 'Sign Out',
    theme: 'Theme',
    language: 'Language',
  },
  header: {
    menuTooltip: 'Menu',
    newTransactionTooltip: 'New transaction',
    profileAlt: 'Profile',
  },
  auth: {
    welcome: 'Welcome',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    loginButton: 'Login',
    pleaseWait: 'Please wait...',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    invalidEmail: 'Enter a valid email address.',
    invalidPassword:
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    loginError: 'Unable to sign in with those credentials.',
    registerError: 'Unable to create your account.',
  },
  home: {
    total: 'Total',
    expenses: 'Expenses',
    incomes: 'Incomes',
    loadingMore: 'Loading more...',
    noData: 'No transaction data available',
  },
  transactions: {
    onlyMonth: (month: string): string => `Only ${month}`,
    fromMonth: (month: string): string => `${month} and the following months`,
    deleteTitle: (name: string): string => `Delete ${name}?`,
    monthlyScopeTitle: 'Which months should change?',
    onlyMonthHint: "Change only this month's amount, date or notes.",
    fromMonthHint: 'Use the new values from this month on.',
    earlierUnchanged: 'Earlier months stay as they are.',
    changedThisMonth: 'changed this month',
    dateInMonth: 'Choose a date inside the selected month.',
    editAriaLabel: 'Edit transaction',

    newTransaction: 'New transaction',
    repeatsTooltip: 'Does it repeat?',
    repeatsNone: 'None',
    repeatsMonthly: 'Monthly',
    typeTooltip: 'Transaction Type',
    selectType: 'Select a transaction type',
    categoryTooltip: 'Transaction category',
    selectCategory: 'Select a category',
    numberOfInstallments: 'Number of installments',
    valueGreaterThanZero: 'Value must be greater than zero.',
    selectCategoryError: 'Select a category.',
    invalidInstallments:
      'Installments must be a whole number greater than one.',
    saveError: 'Unable to save transaction.',
    deleteError: 'Unable to delete.',
    deleteAriaLabel: 'Delete transaction',
    dayAndRepeat: (day: string, repeats: string): string =>
      `Day ${day} (${repeats})`,
    paidEarly: 'paid early',
    payInstallmentsEarly: 'Pay installments early',
  },
  prepayment: {
    title: 'Pay installments early',
    description:
      'Pick the installments you prepaid on the card. They move to the day you paid them.',
    paidOn: 'Paid on',
    payEarlyButton: (count: number): string =>
      count > 0 ? `Pay ${count} early` : 'Pay early',
    paidEarlyHeader: 'Paid early',
    paidOnDate: (date: string): string => `paid on ${date}`,
    error: 'Unable to change these installments.',
  },
  savings: {
    investments: 'Investments',
    investmentType: 'Investment type',
    selectInvestmentType: 'Select an investment type',
    investmentTypeRequired: 'Select an investment type.',
    allInvestmentTypes: 'All investment types',
    investmentTypes: {
      TESOURO_DIRETO: 'Treasury bonds (Tesouro Direto)',
      CDB: 'CDB',
      LCI_LCA: 'LCI/LCA',
      CREDIT_BONDS: 'Corporate bonds (debentures, CRI, CRA)',
      STOCKS: 'Stocks',
      REAL_ESTATE_FUNDS: 'Real estate funds (FIIs)',
      ETFS: 'ETFs',
      BDRS: 'BDRs',
      CRYPTO: 'Crypto',
      INVESTMENT_FUNDS: 'Investment funds',
      PRIVATE_PENSION: 'Private pension',
      FOREIGN: 'Investments abroad',
      OTHER_INVESTMENT: 'Other investments',
    },
    investmentGroups: {
      fixedIncome: 'Fixed income',
      variableIncome: 'Variable income',
      fundsAndPension: 'Funds and pension',
      other: 'Other',
    },
    title: 'Savings',
    subtitle: 'Know where your money is and how far it can take you.',
    runway: 'Emergency runway',
    months: 'months',
    runwayNote:
      'Total saved ÷ average expenses over the last 3 full months. Months without expenses are excluded.',
    noRunway: 'Add expenses to calculate your runway.',
    liquidity: 'Liquid and invested',
    liquid: 'Liquid',
    invested: 'Invested',
    other: 'Other',
    largest: 'Largest location',
    allocation: 'Allocation',
    search: 'Search by name',
    sort: 'Sort entries',
    sortAmount: 'Amount · highest first',
    sortName: 'Name · A–Z',
    sortUpdated: 'Last updated · newest first',
    all: 'All locations',
    noMatches: 'No entries match your filters.',
    location: 'Location',
    unknownUpdated: 'Update date unavailable',
    review: 'Review this balance',
    confirmDelete: 'Delete this entry?',
    confirm: 'Confirm delete',
    cancel: 'Cancel',
    loading: 'Loading savings',
    loadError: 'Unable to load savings.',
    expensesError: 'Unable to load expenses for runway.',
    nameRequired: 'Enter a name.',
    amountInvalid: 'Enter a finite amount of zero or more in BRL.',
    updated: (distance: string): string => `Updated ${distance}`,

    totalSaved: 'Total saved',
    entries: 'Entries',
    editTitle: 'Edit saved money',
    addTitle: 'Add saved money',
    amount: 'Amount',
    byLocation: 'By location',
    savedMoney: 'Saved money',
    empty: 'No saved money added yet.',
    invalidForm: 'Add a name and a valid amount.',
    saveError: 'Unable to save this entry.',
    deleteError: 'Unable to delete this entry.',
    locations: {
      CASH: 'Cash',
      CHECKING_ACCOUNT: 'Checking',
      SAVINGS_ACCOUNT: 'Savings',
      INVESTMENT: 'Investments',
      OTHER: 'Other',
    },
  },
  profile: {
    title: 'Profile',
    chooseImage: 'Choose Image',
    deleteImage: 'Delete image',
    greeting: (name: string): string => `Hello, ${name} 👋`,
    confirmPassword: 'Confirm Password',
    passwordsMatchError: 'Passwords must match.',
    passwordRequirementsError:
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    saveError: 'Unable to save profile changes.',
    deleteImageError: 'Unable to delete profile image.',
  },
  import: {
    title: 'Import a statement',
    description:
      'Bradesco card PDF, NuBank card bill PDF or NuBank CSV. Nothing is saved until you review the lines and press Import.',
    statementFile: 'Statement file',
    pdfPassword: 'PDF password',
    reading: 'Reading...',
    readStatement: 'Read statement',
    importedTransactions: (count: number): string =>
      count === 1 ? '1 transaction' : `${count} transactions`,
    importSuccess: (
      imported: number,
      skipped: number,
      moved: number
    ): string => {
      const parts: string[] = [
        `Imported ${imported} ${imported === 1 ? 'transaction' : 'transactions'}`,
      ];
      if (skipped > 0) {
        parts.push(`skipped ${skipped} already saved`);
      }
      if (moved > 0) {
        parts.push(
          `moved ${moved} prepaid ${moved === 1 ? 'installment' : 'installments'}`
        );
      }
      return `${parts.join(', ')}.`;
    },
    newCategory: 'New category',
    newCategoryName: 'New category name',
    newCategoryType: 'New category type',
    addCategory: 'Add category',
    summary: (
      total: number,
      duplicates: number,
      credits: number,
      suggested: number
    ): string =>
      `${total} lines · ${duplicates} already saved · ${credits} credits · ${suggested} with a suggested category`,
    totalsMatch: 'Every line was read: they add up to the statement total.',
    totalsMismatch: (parsed: number, printed: number): string =>
      `Lines add up to ${parsed} but the statement shows ${printed}. Some line may be missing; check before importing.`,
    hideAlreadySaved: 'Hide already saved',
    selectAll: 'Select all',
    selectNone: 'Select none',
    categoryForSelected: 'Category for selected expenses…',
    importColumn: 'Import',
    descriptionColumn: 'Description',
    statusColumn: 'Status',
    incomeCategoryPlaceholder: 'Income category…',
    expenseCategoryPlaceholder: 'Expense category…',
    selectedCount: (selected: number, missingCategory: number): string =>
      `${selected} selected${missingCategory > 0 ? ` · ${missingCategory} still need a category` : ''}`,
    importCount: (count: number): string => `Import ${count}`,
    importing: 'Importing...',
    seeOnHome: 'See them on Home',
    emptyPreview: 'Choose a statement to see its lines here.',
    importRow: (description: string): string => `Import ${description}`,
    categoryForRow: (description: string): string =>
      `Category for ${description}`,
    sources: {
      BRADESCO_CARD_PDF: 'Bradesco card statement (PDF)',
      NUBANK_CARD_PDF: 'NuBank card bill (PDF)',
      NUBANK_CARD_CSV: 'NuBank card bill (CSV)',
    },
    suggestions: {
      sameMerchantYouSet: 'Same merchant as a line you set',
      exact: (count: number): string =>
        `Used before for this description${count > 1 ? ` (${count}×)` : ''}`,
      merchant: (basis: string, count: number): string =>
        `Same merchant as “${basis}”${count > 1 ? ` (${count}×)` : ''}`,
      keyword: (basis: string): string => `Known merchant: “${basis}”`,
      similar: (basis: string, count: number): string =>
        `Similar to “${basis}”${count > 1 ? ` (${count}×)` : ''}`,
      purchase: (basis: string): string =>
        `Category of the saved purchase “${basis}”`,
    },
    statuses: {
      alreadyImported: 'Already imported',
      samePurchaseAsLine: (line: number): string =>
        `Same purchase as line ${line}`,
      credit: 'Credit',
      new: 'New',
      prepaidAlreadyPaid: (day: string): string =>
        `Already paid early on ${day}`,
      prepaidMoves: (installment: string, day: string): string =>
        `Paid early: moves ${installment} to ${day}`,
      prepaidMovesLine: (
        installment: string,
        line: number,
        day: string
      ): string => `Paid early: moves ${installment} of line ${line} to ${day}`,
      prepaidCreates: (installment: string, day: string): string =>
        `Paid early: creates the purchase, ${installment} on ${day}`,
    },
    lineDetails: {
      installmentPaidEarly: (number: number, total: number): string =>
        `Installment ${number}/${total} · paid early`,
      installmentCreatesAll: (number: number, total: number): string =>
        `Installment ${number}/${total} · creates all ${total}`,
    },
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Understand your cash flow. Make room for what comes next.',
    periods: {
      week: 'Week',
      month: 'Month',
      year: 'Year',
      custom: 'Custom',
    },
    previous: 'Previous period',
    next: 'Next period',
    today: 'Today',
    from: 'From',
    to: 'To',
    invalid:
      'Choose a valid start and end day. The start must be on or before the end.',
    loading: 'Loading your financial overview…',
    error: 'Your data could not be loaded. Please try again.',
    empty: 'No activity in this period.',
    figures: {
      income: 'Income',
      expenses: 'Expenses',
      net: 'Net balance',
      savingsRate: 'Savings rate',
      dailyAverage: 'Average spending / day',
    },
    comparison: 'vs. previous period',
    noBaseline: 'No previous baseline',
    periodNote:
      'Figures include scheduled charges throughout the selected period. Daily averages use days elapsed for a period containing today. Comparisons use the preceding equal number of days.',
    budget: 'Your spending room',
    budgetNote:
      'Calendar-month outlook, independent of the selected period. Commitments include installments and repeating charges. Due dates are used as the spending date.',
    thisMonth: 'This month',
    nextMonth: 'Next month',
    expected: 'Expected income',
    estimate: 'Estimate · average of the last 3 months with income',
    spent: 'Spent so far',
    committed: 'Still to come',
    nextCommitted: 'Committed expenses',
    left: 'Left after commitments',
    free: 'Free to spend',
    daily: 'Per remaining day',
    nextDaily: 'Per day',
    remaining: 'Days remaining after today',
    spentShare: 'Income spent',
    dailyChart: 'Spending rhythm',
    dailyNote:
      'Daily bars for short periods; longer periods show average daily spending by week or month. The allowance is period income divided by calendar days.',
    allowance: 'Daily allowance',
    dailySpending: 'Spending / day',
    flowChart: 'Income vs. expenses',
    cumulativeChart: 'Cumulative spending vs. income',
    categories: 'Where your money goes',
    merchants: 'Top merchants',
    unknownMerchant: 'Without a merchant',
    unknownCategory: 'Uncategorized',
    installments: 'The next 6 months, already committed',
    installmentNote:
      'Installments only, grouped by category. Early payments follow their updated due date.',
    savings: 'Savings by location',
    totalSaved: 'Total saved',
    locations: {
      [SavingLocation.CASH]: 'Cash',
      [SavingLocation.CHECKING_ACCOUNT]: 'Checking',
      [SavingLocation.SAVINGS_ACCOUNT]: 'Savings',
      [SavingLocation.INVESTMENT]: 'Investments',
      [SavingLocation.OTHER]: 'Other',
    },
  },
} as const;

type RecursiveMessages<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer Args) => string
    ? (...args: Args) => string
    : T[K] extends object
      ? RecursiveMessages<T[K]>
      : string;
};

export type Messages = RecursiveMessages<typeof en>;
