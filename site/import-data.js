;(function (root) {
  'use strict'
  var fields = [
    'Code',
    'Focus Keyphrase',
    'Actor',
    'Tags',
    'Studio',
    'Categories',
    'Title',
    'Content',
    'Meta Description',
    'Actor EN',
    'Duration',
    'Video URL',
    'Poster URL',
    'Cover URL',
    'Gallery URLs',
    'Release Date',
  ]
  function key(value) {
    return String(value)
      .toLowerCase()
      .replace(/[\s_-]/g, '')
  }
  function canonical(value) {
    return (
      fields.find(function (f) {
        return key(f) === key(value)
      }) || value
    )
  }
  function valid(rows) {
    if (
      !Array.isArray(rows) ||
      !rows.length ||
      rows.some(function (r) {
        return !r || typeof r !== 'object' || Array.isArray(r)
      })
    )
      throw new Error('ข้อมูลต้องเป็นรายการของเรื่อง')
    rows = rows.map(function (r) {
      var o = {}
      Object.keys(r).forEach(function (k) {
        o[canonical(k)] = r[k]
      })
      return o
    })
    if (
      rows.some(function (r) {
        return !String(r.Code || r.Title || r.jav_code || '').trim()
      })
    )
      throw new Error('แต่ละเรื่องต้องมี Code หรือ Title กรุณาตรวจรูปแบบข้อมูล')
    return rows
  }
  function table(text, delimiter) {
    var rows = [],
      row = [],
      cell = '',
      quoted = false
    for (var i = 0; i < text.length; i++) {
      var c = text[i]
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"'
          i++
        } else if (quoted || !cell) quoted = !quoted
        else cell += c
      } else if (!quoted && (c === delimiter || c === '\n')) {
        row.push(cell.replace(/\r$/, ''))
        cell = ''
        if (c === '\n') {
          if (
            row.some(function (v) {
              return v.trim()
            })
          )
            rows.push(row)
          row = []
        }
      } else cell += c
    }
    if (quoted) throw new Error('เครื่องหมายคำพูดในตารางปิดไม่ครบ')
    row.push(cell.replace(/\r$/, ''))
    if (
      row.some(function (v) {
        return v.trim()
      })
    )
      rows.push(row)
    return rows
  }
  function parse(text) {
    text = String(text)
      .replace(/^\uFEFF/, '')
      .trim()
    if (!text) throw new Error('ยังไม่มีข้อมูลที่จะนำเข้า')
    if (/^(?:\[|\{)/.test(text)) {
      var data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('JSON ไม่ถูกต้อง')
      }
      return valid(
        Array.isArray(data)
          ? data
          : data.items || data.data || data.posts || [data],
      )
    }
    // A header with several recognized fields identifies a delimited table.
    var delimiters = [',', '\t', ';', '|']
    for (var d of delimiters) {
      var header = table(text.split('\n')[0], d)[0] || []
      if (
        header.length > 1 &&
        header.filter(function (h) {
          return fields.indexOf(canonical(h.trim())) >= 0
        }).length > 1
      ) {
        var cells = table(text, d)
        header = cells.shift().map(function (h) {
          return canonical(h.trim())
        })
        return valid(
          cells.map(function (r) {
            if (r.length !== header.length)
              throw new Error(
                'จำนวนคอลัมน์ไม่ตรงกับหัวตาราง กรุณาครอบค่าที่มีตัวคั่นด้วยเครื่องหมายคำพูด',
              )
            var o = {}
            header.forEach(function (h, i) {
              o[h] = r[i]
            })
            return o
          }),
        )
      }
    }
    var records = [],
      current = {},
      active = null
    text.split(/\r?\n/).forEach(function (line) {
      var match = line.match(/^\s*([^,:：=\t]+?)\s*[,：:=\t]\s*(.*)$/)
      var f = match && canonical(match[1])
      if (match && fields.indexOf(f) >= 0) {
        if (
          (f === 'Code' && Object.keys(current).length) ||
          (f === 'Title' && current.Title && !current.Code)
        ) {
          records.push(current)
          current = {}
        }
        current[f] = match[2]
        active = f
      } else if (active) current[active] += '\n' + line
      else if (line.trim())
        throw new Error(
          'ข้อความต้องระบุชื่อฟิลด์ เช่น Code: ABC-001 และ Title: ชื่อเรื่อง',
        )
    })
    if (Object.keys(current).length) records.push(current)
    return valid(records)
  }
  root.VaultImport = { parse: parse }
})(globalThis)
