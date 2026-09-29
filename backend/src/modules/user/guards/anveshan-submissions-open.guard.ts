import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserService } from '../user.service';

export const ANVESHAN_COMPLETED_MESSAGE =
  'You have completed your Anveshan milestone, so new submissions are closed. Please continue on the Anveshan platform.';

// Blocks new submissions from Anveshan users who have already reached 100% of their milestone.
// Runs after JwtAuthGuard, so the authenticated user is on the request.
@Injectable()
export class AnveshanSubmissionsOpenGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = request.user?.id;
    if (!userId) return true;

    if (await this.userService.isAnveshanMilestoneCompleted(userId)) {
      throw new ForbiddenException(ANVESHAN_COMPLETED_MESSAGE);
    }
    return true;
  }
}
