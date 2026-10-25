// Smena boshida tashlangan qoldiq chiqimlarning sababi shu matn bilan boshlanadi
// ("Smena boshida chiqindi" yoki kassir izohi bilan: "Smena boshida chiqindi: sinib qolgan").
export const SMENA_BOSHI = 'Smena boshida chiqindi'

export const isStartDiscard = (reason: string | null | undefined): boolean => (reason ?? '').startsWith(SMENA_BOSHI)
