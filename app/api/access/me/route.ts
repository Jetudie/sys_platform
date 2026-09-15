import { getAccessContext } from '@/app/access-control';
import { chatGPTSignInPath, chatGPTSignOutPath } from '@/app/chatgpt-auth';

export async function GET() {
  const access = await getAccessContext();
  return Response.json({ ...access, signInPath: chatGPTSignInPath('/'), signOutPath: chatGPTSignOutPath('/') }, { headers: { 'cache-control': 'no-store' } });
}
