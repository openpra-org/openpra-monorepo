import {
  Controller,
  Get as _Get,
  Post as _Post,
  Patch as _Patch,
  Delete as _Delete,
  Request as _Request,
  Param as _Param,
  Query as _Query,
  Body as _Body,
  HttpStatus as _HttpStatus,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class HclController {}
