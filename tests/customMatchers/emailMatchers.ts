const toHaveCalledWithMailInfo = function (
  this: jest.MatcherContext,
  received: any,
  to: string,
  subjectIncludes: string,
  htmlIncludes: string[]
) {
    const call = (received as jest.Mock).mock.calls[0]?.[0];

    const pass = Boolean(
        call &&
        call.to === to &&
        call.subject.includes(subjectIncludes) &&
        htmlIncludes.every((text) => call.html.includes(text))
    );

  return {
    pass,
    message: () =>
      pass
        ? `expected mail not to be sent with correct info`
        : `expected mail to be sent with:
            to = ${to}, 
            subjectIncludes = ${subjectIncludes}, 
            htmlIncludes = ${htmlIncludes}`,
  };
};

export { toHaveCalledWithMailInfo };