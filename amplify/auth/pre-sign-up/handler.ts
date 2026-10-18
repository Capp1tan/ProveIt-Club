// No une cuentas por su correo: compartir una dirección no concede acceso a otro perfil.
import {createHash} from 'node:crypto';
import {CognitoIdentityProviderClient,ListUsersCommand} from '@aws-sdk/client-cognito-identity-provider';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand} from '@aws-sdk/lib-dynamodb';
import {parsePhoneNumberFromString} from 'libphonenumber-js/max';
const cognito=new CognitoIdentityProviderClient({}),db=DynamoDBDocumentClient.from(new DynamoDBClient({}));
type Event={triggerSource:string;userPoolId:string;userName:string;request:{userAttributes:Record<string,string>};response:Record<string,unknown>};
export const handler=async(event:Event)=>{
 const attrs=event.request.userAttributes,email=String(attrs.email || '').trim().toLowerCase();
 if(!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Ingresá un correo válido.');
 const native=event.triggerSource==='PreSignUp_SignUp';
 if(native){const nick=String(attrs.nickname || '').trim(),phone=parsePhoneNumberFromString(attrs.phone_number || '');if(nick.length<3 || nick.length>24 || !phone?.isValid() || phone.ext)throw new Error('Completá el nick (3–24 caracteres) y un teléfono válido para crear tu cuenta.');}
 // Se revisan también las cuentas antiguas, cuyos correos conservaron mayúsculas.
 let token:string|undefined;
 do{const page=await cognito.send(new ListUsersCommand({UserPoolId:event.userPoolId,Limit:60,PaginationToken:token}));
  if(page.Users?.some(u=>u.Username!==event.userName && u.Attributes?.find(a=>a.Name==='email')?.Value?.trim().toLowerCase()===email))throw new Error('Este correo ya tiene una cuenta en ProveIt. Usá su método de ingreso original o recuperá la contraseña. Para vincular Google, contactá a administración.');token=page.PaginationToken;
 }while(token);
 // La reserva atómica cubre dos altas simultáneas (email y Google). Expira para no
 // bloquear permanentemente un correo si el alta falla antes de crear la identidad.
 const now=Math.floor(Date.now()/1000);
 try{await db.send(new PutCommand({TableName:process.env.REGISTRATION_TABLE_NAME!,Item:{id:'email:'+createHash('sha256').update(email).digest('hex'),claimant:event.userName,expiresAt:now+1800},ConditionExpression:'attribute_not_exists(id) OR expiresAt<:now OR claimant=:claimant',ExpressionAttributeValues:{':now':now,':claimant':event.userName}}));}
 catch(e){if((e as Error).name!=='ConditionalCheckFailedException')throw e;throw new Error('Ya hay un registro en curso con este correo. Revisá tu email o intentá recuperar el acceso.');}
 return event;
};
