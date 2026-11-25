import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=30',
};

export const handler = async (event: { requestContext?: { http?: { method?: string } } }) => {
  if (event.requestContext?.http?.method !== 'GET') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ photos: [] }) };
  }
  try {
    const result = await db.send(new QueryCommand({
      TableName: process.env.SOCIAL_TABLE_NAME!,
      KeyConditionExpression: 'pk=:pk AND begins_with(sk,:prefix)',
      ExpressionAttributeValues: { ':pk': 'COMMUNITY_GALLERY', ':prefix': 'PHOTO#' },
      Limit: 40,
      ScanIndexForward: true,
      ConsistentRead: true,
    }));
    const photos = await Promise.all((result.Items || []).map(async (photo: any) => {
      if (typeof photo.path !== 'string' || !/^community-gallery\/[a-f0-9-]{36}\.webp$/i.test(photo.path)) return null;
      return {
        id: photo.id,
        title: String(photo.title || 'Ganador del club').slice(0, 80),
        detail: String(photo.detail || 'Salón de la fama · ProveIt Club').slice(0, 180),
        alt: String(photo.alt || photo.title || 'Foto de un ganador de ProveIt Club').slice(0, 140),
        src: await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.PROFILE_BUCKET_NAME!, Key: photo.path }), { expiresIn: 3600 }),
      };
    }));
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ photos: photos.filter(Boolean) }) };
  } catch (error) {
    console.error('winner_gallery_read_failed', { name: (error as Error).name });
    return { statusCode: 503, headers: { ...jsonHeaders, 'cache-control': 'no-store' }, body: JSON.stringify({ photos: [] }) };
  }
};
