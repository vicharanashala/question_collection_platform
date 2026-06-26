import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LgdService } from './lgd.service';
import { SkipJwtAuth } from '../auth/decorators/skip-jwt-auth.decorator';

@SkipJwtAuth()
@Controller('lgd')
export class LgdController {
    constructor(private readonly lgdService: LgdService) {}

    @Get('states')
    async getStates() {
        const records = await this.lgdService.getStates();
        return {
            states: records.map((r) => ({
                code: String(r['state_code'] ?? '').trim(),
                name: String(r['state_name_english'] ?? '').trim(),
            })),
        };
    }

    @Get('districts')
    async getDistricts(@Query('stateCode') stateCode: string) {
        if (!stateCode) throw new BadRequestException('stateCode query param is required');
        const records = await this.lgdService.getDistricts(stateCode);
        return {
            districts: records.map((r) => ({
                code: String(r['district_code'] ?? '').trim(),
                name: String(r['district_name_english'] ?? '').trim(),
                stateCode: String(r['state_code'] ?? '').trim(),
            })),
        };
    }

    @Get('subdistricts')
    async getSubDistricts(@Query('districtCode') districtCode: string) {
        if (!districtCode) throw new BadRequestException('districtCode query param is required');
        const records = await this.lgdService.getSubDistricts(districtCode);
        return {
            subdistricts: records.map((r) => ({
                code: String(r['subdistrict_code'] ?? '').trim(),
                name: String(r['subdistrict_name_english'] ?? '').trim(),
                districtCode: String(r['district_code'] ?? '').trim(),
            })),
        };
    }

    @Get('villages')
    async getVillages(@Query('blockCode') blockCode: string) {
        if (!blockCode) throw new BadRequestException('blockCode query param is required');
        const records = await this.lgdService.getVillages(blockCode);
        return {
            villages: records.map((r) => ({
                code: String(r['village_code'] ?? '').trim(),
                name: String(r['village_name_english'] ?? '').trim(),
                blockCode: String(r['subdistrict_code'] ?? '').trim(),
            })),
        };
    }
}