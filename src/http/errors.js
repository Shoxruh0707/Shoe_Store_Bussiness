const {randomUUID}=require('node:crypto');
function createErrorHandler({logger=console}={}) {
  return (error, _request, response, next) => {
    if(response.headersSent) return next(error);
    const requestId=randomUUID();
    let status=500;
    let message="Server xatosi. Keyinroq qayta urinib ko'ring.";
    if(error.type==='entity.parse.failed') {status=400;message="So'rov JSON formati noto'g'ri.";}
    else if(error.type==='entity.too.large') {status=413;message="Yuklangan ma'lumot juda katta.";}
    else if(error.expose===true && Number.isInteger(error.statusCode) && error.statusCode>=400 && error.statusCode<500) {status=error.statusCode;message=error.message;}
    else if(error.code==='ER_DUP_ENTRY') {status=409;message='Bu qiymat allaqachon mavjud.';}
    const knownCodes=new Set(['ER_DUP_ENTRY','ER_BAD_FIELD_ERROR','ER_NO_REFERENCED_ROW_2','ER_ROW_IS_REFERENCED_2','ECONNREFUSED','ETIMEDOUT']);
    logger.error({event:'request_failed',requestId,code:knownCodes.has(error.code)?error.code:'REQUEST_ERROR'});
    response.status(status).json({success:false,error:message,message,requestId});
  };
}
module.exports={createErrorHandler};
