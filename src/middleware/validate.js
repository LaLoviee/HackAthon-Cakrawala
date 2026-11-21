// Validasi req.body dengan skema zod; error ditangani errorHandler
const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};

module.exports = { validate };
