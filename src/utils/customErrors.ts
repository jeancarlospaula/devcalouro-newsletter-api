interface ICustomError {
  statusCode: number;
  data: Object;
}

class CustomError {
  statusCode: number;
  data: Object;

  constructor({ statusCode, data }: ICustomError) {
    this.statusCode = statusCode;
    this.data = data;
  }
}

interface IErrorsResponses {
  ExistingEmail(): CustomError;
  InvalidToken(): CustomError;
  InvalidEmail(): CustomError;
  UnconfirmedEmail(): CustomError;
  AlreadyMember(): CustomError;
}

class ErrorResponses implements IErrorsResponses {
  ExistingEmail() {
    return new CustomError({
      statusCode: 200,
      data: {
        error: {
          message: 'Email já cadastrado na Newsletter @dev.calouro.',
        },
      },
    });
  }

  InvalidToken() {
    return new CustomError({
      statusCode: 400,
      data: {
        error: {
          message: 'Token inválido.',
        },
        redirectURL: process.env.ERROR_URL as string,
      },
    });
  }

  InvalidEmail() {
    return new CustomError({
      statusCode: 400,
      data: {
        error: {
          message:
            'Email não cadastrado na Newsletter @dev.calouro. Verifique se o email está correto.',
        },
      },
    });
  }

  UnconfirmedEmail() {
    return new CustomError({
      statusCode: 400,
      data: {
        error: {
          message:
            'Email não confirmado. Verifique sua caixa de entrada e confirme o seu email.',
        },
      },
    });
  }

  AlreadyMember() {
    return new CustomError({
      statusCode: 200,
      data: {
        message: 'Email adicionado à lista VIP de membros com sucesso.',
      },
    });
  }
}

const errorResponses = new ErrorResponses();

export { errorResponses, CustomError };
