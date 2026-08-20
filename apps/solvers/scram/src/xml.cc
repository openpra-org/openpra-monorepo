/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2023 OpenPRA ORG Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file
/// XML facility expensive wrappers implemented out-of-line.

#include "xml.h"

#include <libxml/xinclude.h>

namespace scram::xml {

Document::Document(const std::string& file_path, Validator* validator)
    : doc_(nullptr, &xmlFreeDoc) {
  xmlResetLastError();
  doc_.reset(xmlReadFile(file_path.c_str(), nullptr, kParserOptions));
  const xmlError* xml_error = xmlGetLastError();
  if (xml_error) {
    if (xml_error->domain == xmlErrorDomain::XML_FROM_IO) {
      SCRAM_THROW(IOError(xml_error->message))
          << boost::errinfo_file_name(file_path) << boost::errinfo_errno(errno)
          << boost::errinfo_file_open_mode("r");
    }
    SCRAM_THROW(detail::GetError<ParseError>(xml_error));
  }
  assert(doc_ && "Internal XML library failure.");
  if (xmlXIncludeProcessFlags(get(), kParserOptions) < 0 || xmlGetLastError())
    SCRAM_THROW(detail::GetError<XIncludeError>());
  if (validator)
    validator->validate(*this);
}

Validator::Validator(const std::string& rng_file)
    : schema_(nullptr, &xmlRelaxNGFree),
      valid_ctxt_(nullptr, &xmlRelaxNGFreeValidCtxt) {
  xmlResetLastError();
  std::unique_ptr<xmlRelaxNGParserCtxt, decltype(&xmlRelaxNGFreeParserCtxt)>
      parser_ctxt(xmlRelaxNGNewParserCtxt(rng_file.c_str()),
                  &xmlRelaxNGFreeParserCtxt);
  if (!parser_ctxt)
    SCRAM_THROW(detail::GetError<LogicError>());

  initialize_schema(parser_ctxt.get());
}

Validator Validator::from_memory(const std::string_view& rng_content) {
  Validator validator;
  xmlResetLastError();
  std::unique_ptr<xmlRelaxNGParserCtxt, decltype(&xmlRelaxNGFreeParserCtxt)>
      parser_ctxt(xmlRelaxNGNewMemParserCtxt(rng_content.data(), rng_content.size()),
                  &xmlRelaxNGFreeParserCtxt);
  if (!parser_ctxt)
    SCRAM_THROW(detail::GetError<LogicError>());

  validator.initialize_schema(parser_ctxt.get());
  return validator;
}

void Validator::initialize_schema(xmlRelaxNGParserCtxt* parser_ctxt) {
  schema_.reset(xmlRelaxNGParse(parser_ctxt));
  if (!schema_)
    SCRAM_THROW(detail::GetError<ParseError>());

  valid_ctxt_.reset(xmlRelaxNGNewValidCtxt(schema_.get()));
  if (!valid_ctxt_)
    SCRAM_THROW(detail::GetError<LogicError>());
}

}  // namespace scram::xml
