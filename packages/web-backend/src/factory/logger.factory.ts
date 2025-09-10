import { transports, format, Logform } from "winston";
import { WinstonModule, utilities as nestWinstonModuleUtilities } from "nest-winston";

export const LoggerFactory = (appName: string): ReturnType<typeof WinstonModule.createLogger> => {
  let consoleFormat: Logform.Format;

  const Debug = process.env.DEBUG;
  const UseJsonLogger = process.env.USE_JSON_LOGGER;

  if (UseJsonLogger === "true") {
    consoleFormat = format.combine(format.ms(), format.timestamp(), format.json());
  } else {
    consoleFormat = format.combine(
      format.timestamp(),
      format.ms(),
      nestWinstonModuleUtilities.format.nestLike(appName, {
        colors: true,
        prettyPrint: true,
      }),
    );
  }

  return WinstonModule.createLogger({
    level: Debug ? "debug" : "info",
    transports: [new transports.Console({ format: consoleFormat })],
  });
};
