declare module 'json2xls' {
  interface Json2XlsOptions {
    fields?: Record<string, string>;
  }
  function json2xls(data: Record<string, unknown>[], options?: Json2XlsOptions): Buffer;
  export = json2xls;
}