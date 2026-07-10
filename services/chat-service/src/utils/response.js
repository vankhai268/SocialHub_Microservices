export const successResponse = (res, statusCode, data, pagination = null) => {
  const response = {
    success: true,
    data
  };
  
  if (pagination) {
    response.pagination = pagination;
  }
  
  return res.status(statusCode).json(response);
};

export const errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    error: message
  };

  if (errors) {
    response.details = errors;
  }

  return res.status(statusCode).json(response);
};
