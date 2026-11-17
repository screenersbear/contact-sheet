// window.DFData: everything the notebooks use from the shared data files,
// put together. Loaded last, after the other files in data/shared/.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const {
    open, rows, getOne, putMany, deleteOne, hasText, nowIso, todayStr, uid, eyeState, eyeShootName,
    exportDb, importDb, sizeText, zipBackup, backupSteps, isZipFile, restoreZip, backupManifest, linksWhere,
    getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile, readBoardFile, saveFile,
    pickFiles, pickFile, inSuite, notebookUrl, cleanHandle, personKeys, findPerson, maybePairs,
    peopleAll, getPerson, gatherPeople, answerSame, editPerson, personFor, personUrl,
    PEOPLE_APPS, pictureOf, shootPeople, publishThings, thingsAll, thingsFor, roleOf, forgetPerson, personView, searchIn, searchAll,
    askRounds, roundsAsks, doneWithAsks
  } = parts;

  window.DFData = {
    open, rows, getOne, putMany, deleteOne, hasText, todayStr, uid, nowIso,
    eyeState, eyeShootName,
    exportDb, importDb, saveFile, pickFile, pickFiles,
    zipBackup, backupSteps, isZipFile, restoreZip, backupManifest, sizeText,
    inSuite, notebookUrl,
    linksWhere, getLink, saveLink, linkPictures, dropLinks, pictureUrl, boardFile, readBoardFile,
    cleanHandle, personKeys, findPerson, maybePairs, peopleAll, getPerson, gatherPeople, answerSame,
    editPerson, personFor, personUrl, PEOPLE_APPS, pictureOf, shootPeople, publishThings, thingsAll, thingsFor, roleOf, forgetPerson, personView, searchIn, searchAll,
    askRounds, roundsAsks, doneWithAsks,
  };
})();
