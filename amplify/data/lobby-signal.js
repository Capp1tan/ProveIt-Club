import { util, extensions } from '@aws-appsync/utils';
// Señal mínima por torneo: no publica la invitación privada ni la identidad del receptor.
export function request() { return { payload: null }; }
export function response(ctx) {
  if (!ctx.identity?.sub || !ctx.args.tournamentId) util.unauthorized();
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter({ tournamentId: { eq: ctx.args.tournamentId } }));
  return null;
}
