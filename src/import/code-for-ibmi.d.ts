export interface IBMiObject {
    library: string,
    name: string,
    type: string,
    text: string,
    attribute?: string
}

export interface Filter {
    library: string,
    filter: string
}