import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import {
  LgdService,
  LgdState,
  LgdDistrict,
  LgdSubDistrict,
  LgdVillage,
  LgdKvk,
} from './lgd.service';
import { SkipJwtAuth } from '../auth/decorators/skip-jwt-auth.decorator';

@SkipJwtAuth()
@Controller('lgd')
export class LgdController {
  constructor(private readonly lgdService: LgdService) {}

  @Get('states')
  async getStates() {
    const records: LgdState[] = await this.lgdService.getStates();
    return {
      states: records.map((r) => ({
        code: r.state_code.trim(),
        name: r.state_name_english.trim(),
      })),
    };
  }

  @Get('districts')
  async getDistricts(@Query('stateCode') stateCode: string) {
    if (!stateCode) {
      throw new BadRequestException('stateCode query param is required');
    }
    const records: LgdDistrict[] = await this.lgdService.getDistricts(stateCode);
    return {
      districts: records.map((r) => ({
        code: r.district_code.trim(),
        name: r.district_name_english.trim(),
        stateCode: r.state_code.trim(),
      })),
    };
  }

  @Get('subdistricts')
  async getSubDistricts(@Query('districtCode') districtCode: string) {
    if (!districtCode) {
      throw new BadRequestException('districtCode query param is required');
    }
    const records: LgdSubDistrict[] = await this.lgdService.getSubDistricts(districtCode);
    return {
      subdistricts: records.map((r) => ({
        code: r.subdistrict_code.trim(),
        name: r.subdistrict_name_english.trim(),
        districtCode: r.district_code.trim(),
      })),
    };
  }

  @Get('villages')
  async getVillages(@Query('blockCode') blockCode: string) {
    if (!blockCode) {
      throw new BadRequestException('blockCode query param is required');
    }
    const records: LgdVillage[] = await this.lgdService.getVillages(blockCode);
    return {
      villages: records.map((r) => ({
        code: r.villageCode.trim(),
        name: r.villageNameEnglish.trim(),
        blockCode: r.subdistrictCode.trim(),
      })),
    };
  }

  @Get('kvks')
  async getKvks(@Query('districtCode') districtCode: string) {
    if (!districtCode) {
      throw new BadRequestException('districtCode query param is required');
    }
    const records: LgdKvk[] = await this.lgdService.getKvks(districtCode);
    return {
      kvks: records.map((r) => ({
        code: r.kvkCode.trim(),
        name: r.kvkName.trim(),
        address: r.kvkAddress.trim(),
        districtCode: r.districtCode.trim(),
        stateCode: r.stateCode.trim(),
      })),
    };
  }
}