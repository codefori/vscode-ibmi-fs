export default class Base {
    static async get(library: string, name: string): Promise<string> {
        throw new Error(`Not implemented.`);
    }
}