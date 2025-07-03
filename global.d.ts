import 'expect';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidTransactionType(): R;
      toHaveCalledWithMailInfo(to: string, subjectIncludes: string, htmlIncludes: string[]): R;
    }
  }
}
