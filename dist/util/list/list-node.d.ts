export declare class ListNode<T> {
    private _next;
    private _value;
    get next(): ListNode<T>;
    set next(value: ListNode<T>);
    get value(): T;
    set value(value: T);
}
