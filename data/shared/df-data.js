// window.DFData: everything the notebooks use from the shared data files,
// put together. Loaded last, after the other files in data/shared/.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const {
    open, rows, getOne, putMany, deleteOne, hasText, nowIso, todayStr, uid, eyeState, eyeShootName,
    exportDb, importDb, sizeText, zipBackup, backupSteps, isZipFile, restoreZip, linksWhere,
    getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile, readBoardFile, saveFile,
    pickFiles, pickFile, inSuite, notebookUrl, cleanHandle, personKeys, findPerson, maybePairs,
    peopleAll, getPerson, gatherPeople, answerSame, editPerson, personFor, personUrl,
    PEOPLE_APPS, pictureOf, shootPeople, publishThings, thingsAll, personView, searchIn, searchAll
  } = parts;

  window.DFData = {
    open, rows, getOne, putMany, deleteOne, hasText, todayStr, uid, nowIso,
    eyeState, eyeShootName,
    exportDb, importDb, saveFile, pickFile, pickFiles,
    zipBackup, backupSteps, isZipFile, restoreZip, sizeText,
    inSuite, notebookUrl,
    linksWhere, getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile, readBoardFile,
    cleanHandle, personKeys, findPerson, maybePairs, peopleAll, getPerson, gatherPeople, answerSame,
    editPerson, personFor, personUrl, PEOPLE_APPS, pictureOf, shootPeople, publishThings, thingsAll, personView, searchIn, searchAll,
  };
})();
