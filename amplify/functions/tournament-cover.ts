// Portadas privadas: el navegador no elige claves ajenas ni obtiene permisos del bucket.
import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { assertActiveTournament } from './lifecycle';
const s3 = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function validateCover(path: unknown, sub: string, tournamentId: string) {
  if (!path) return null;
  if (typeof path !== 'string' || !path.startsWith(`tournament-covers/${sub}/${tournamentId}/`) ||
      !uuid.test(path.split('/')[3]?.replace(/\.webp$/, '') || '') || path.split('/').length !== 4 || !path.endsWith('.webp')) {
    throw new Error('La portada no pertenece a esta cuenta y este torneo.');
  }
  const object = await s3.send(new HeadObjectCommand({ Bucket: process.env.PROFILE_BUCKET_NAME!, Key: path }));
  if (object.ContentType !== 'image/webp' || !object.ContentLength || object.ContentLength > 2097152) {
    throw new Error('La portada debe ser una imagen WebP de hasta 2 MB.');
  }
  return path;
}

export async function coverAction(db: DynamoDBDocumentClient, sub: string, args: any) {
  if (typeof args.tournamentId !== 'string' || !uuid.test(args.tournamentId)) throw new Error('Identificador de torneo inválido.');
  const Bucket = process.env.PROFILE_BUCKET_NAME!;
  if (args.action === 'COMMUNITY_COVER_UPLOAD') {
    if (args.contentType !== 'image/webp' || !Number.isInteger(args.size) || args.size < 1 || args.size > 2097152) throw new Error('Portada inválida.');
    // Objetos inmutables: un reintento no sobrescribe portadas ya publicadas.
    const path = `tournament-covers/${sub}/${args.tournamentId}/${randomUUID()}.webp`;
    return { path, url: await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: path, ContentType: args.contentType, ContentLength: args.size }), { expiresIn: 120 }) };
  }
  const t = (await db.send(new GetCommand({ TableName: process.env.TOURNAMENT_TABLE_NAME!, Key: { id: args.tournamentId }, ConsistentRead: true }))).Item;
  assertActiveTournament(t);
  if (!t?.coverPath || !t.coverPath.startsWith(`tournament-covers/${t.createdBySub}/${t.id}/`)) throw new Error('Este torneo no tiene portada.');
  return { url: await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: t.coverPath }), { expiresIn: 120 }) };
}
