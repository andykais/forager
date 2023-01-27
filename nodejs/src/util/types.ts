type Literal = boolean | null | number | string;
export type Json = Literal | { [key: string]: Json } | Json[];
