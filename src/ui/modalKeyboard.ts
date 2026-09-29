/** A modal claims a key before the global game keymap. Returning true keeps
 * native DOM behavior (Tab, focused buttons) unless the handler prevents it. */
export type ModalKeyHandler = (event: KeyboardEvent) => boolean;

export class ModalKeyboard {
    private handlers: Array<{ priority: number; handler: ModalKeyHandler }> = [];

    public register(handler: ModalKeyHandler, priority = 0): () => void {
        const entry = { priority, handler };
        this.handlers.push(entry);
        this.handlers.sort((a, b) => b.priority - a.priority);
        return () => { this.handlers = this.handlers.filter(candidate => candidate !== entry); };
    }

    public handle(event: KeyboardEvent): boolean {
        return this.handlers.some(({ handler }) => handler(event));
    }
}

export function isTextEntry(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
}
